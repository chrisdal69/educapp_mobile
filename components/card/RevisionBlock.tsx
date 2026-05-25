import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Image,
} from "react-native";
import WebView from "react-native-webview";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import DocumentScanner from "react-native-document-scanner-plugin";
import * as ImageManipulator from "expo-image-manipulator";
import RNBlobUtil from "react-native-blob-util";
import AppText from "@/components/AppText";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/utils/apiClient";
import { storageGet, storageSet, storageDelete } from "@/utils/storage";
import { buildCardUserFlashImageUrl } from "@/utils/gcsPaths";
import type { Card } from "@/types/cards";

// ── Types ─────────────────────────────────────────────────────────────────────

type UserFlash = {
  id: string;
  imquestion: string;
  imreponse?: string;
};

// ── Shuffle ───────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── HTML: flashcard viewer ────────────────────────────────────────────────────

function buildUserFlashHtml(
  rectoUrl: string,
  versoUrl: string,
  bgColor: string,
  textColor: string,
  cardBg: string,
): string {
  const rectoImg = rectoUrl
    ? `<img src="${rectoUrl}" class="card-img" />`
    : `<div class="placeholder">Recto</div>`;
  const versoImg = versoUrl
    ? `<img src="${versoUrl}" class="card-img" />`
    : `<div class="placeholder">Verso non défini</div>`;
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:${bgColor};-webkit-tap-highlight-color:transparent}
body{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;color:${textColor};padding:5px}
.scene{perspective:1200px;width:100%}
.card-inner{
  position:relative;width:100%;
  transform-style:preserve-3d;
  transition:transform 0.5s cubic-bezier(0.4,0,0.2,1);
  border-radius:18px;
}
.card-inner.flipped{transform:rotateY(180deg)}
.face{
  width:100%;padding:0px 0px;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  backface-visibility:hidden;-webkit-backface-visibility:hidden;
  background:${cardBg};border-radius:18px;
  min-height:200px;
}
.face-back{position:absolute;top:0;left:0;right:0;bottom:0;transform:rotateY(180deg)}
.card-img{max-width:100%;max-height:65vh;border-radius:12px;object-fit:contain}
.placeholder{font-size:18px;color:${textColor};opacity:0.5;padding:40px;text-align:center}
</style></head>
<body>
<div class="scene">
  <div id="card-inner" class="card-inner">
    <div id="face-recto" class="face face-front">${rectoImg}</div>
    <div id="face-verso" class="face face-back">${versoImg}</div>
  </div>
</div>
<script>
function flip(side){
  var card=document.getElementById('card-inner');
  if(side==='verso'){card.classList.add('flipped');}
  else{card.classList.remove('flipped');}
}
window.addEventListener('load',function(){
  var recto=document.getElementById('face-recto');
  var verso=document.getElementById('face-verso');
  var card=document.getElementById('card-inner');
  verso.style.visibility='hidden';verso.style.position='relative';verso.style.transform='none';
  var h2=verso.offsetHeight;
  verso.style.position='';verso.style.visibility='';verso.style.transform='';
  var h1=recto.offsetHeight;
  var maxH=Math.max(h1,h2,200);
  card.style.height=maxH+'px';
  recto.style.height=maxH+'px';
  var h=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);
  window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({t:'load',h:h}));
  card.addEventListener('click',function(){
    window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({t:'flip'}));
  });
});
</script>
</body></html>`;
}

// ── HTML: image editor ────────────────────────────────────────────────────────

function buildEditorHtml(b64clean: string): string {
  return `<!DOCTYPE html><html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#1a1a1a;height:100%;overflow:hidden;-webkit-tap-highlight-color:transparent;user-select:none}
body{display:flex;flex-direction:column;height:100%;font-family:-apple-system,sans-serif}
#pw{flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:12px;min-height:0}
#imgwrap{position:relative;display:inline-flex}
#preview{max-width:100%;max-height:38vh;border-radius:8px;display:block}
#crop-canvas{display:none;position:absolute;top:0;left:0;border-radius:8px;touch-action:none}
#controls{padding:10px 16px 4px;background:#111}
.sr{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.sl{color:#999;font-size:12px;width:72px;flex-shrink:0}
input[type=range]{-webkit-appearance:none;flex:1;height:4px;background:#444;border-radius:2px;outline:none}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:#4a90d9;cursor:pointer;border:2px solid #fff}
.vl{color:#fff;font-size:12px;width:38px;text-align:right;flex-shrink:0}
#toolrow{display:flex;gap:10px;padding:6px 16px}
#brot{flex:1;padding:10px;border-radius:10px;background:#8e44ad;color:#fff;font-size:14px;font-weight:600;border:none}
#bcrop{flex:1;padding:10px;border-radius:10px;background:#27ae60;color:#fff;font-size:14px;font-weight:600;border:none}
#bwrow{padding:0 16px 6px}
#bbw{width:100%;padding:10px;border-radius:10px;background:#e67e22;color:#fff;font-size:14px;font-weight:600;border:none}
#btns{display:flex;gap:10px;padding:6px 16px 16px}
#bc{flex:1;padding:13px;border-radius:10px;background:#333;color:#fff;font-size:15px;border:none}
#bk{flex:1;padding:13px;border-radius:10px;background:#4a90d9;color:#fff;font-size:16px;font-weight:600;border:none}
#cropbtns{display:none;gap:10px;padding:6px 16px 16px}
#bcropcancel{flex:1;padding:13px;border-radius:10px;background:#555;color:#fff;font-size:15px;border:none}
#bcropok{flex:1;padding:13px;border-radius:10px;background:#2ecc71;color:#fff;font-size:15px;font-weight:600;border:none}
canvas{display:none}
</style>
</head>
<body>
<div id="pw"><div id="imgwrap"><img id="preview" /><canvas id="crop-canvas"></canvas></div></div>
<div id="controls">
  <div class="sr"><span class="sl">Luminosité</span><input type="range" id="sb" min="0" max="200" value="100"><span class="vl" id="vb">100%</span></div>
  <div class="sr"><span class="sl">Contraste</span><input type="range" id="sc" min="0" max="300" value="100"><span class="vl" id="vc">100%</span></div>
  <div class="sr"><span class="sl">Saturation</span><input type="range" id="ss" min="0" max="200" value="100"><span class="vl" id="vs">100%</span></div>
  <div class="sr"><span class="sl">N &amp; B</span><input type="range" id="sg" min="0" max="100" value="0"><span class="vl" id="vg">0%</span></div>
</div>
<div id="toolrow">
  <button id="brot">↻ Tourner</button>
  <button id="bcrop">✂ Rogner</button>
</div>
<div id="bwrow"><button id="bbw">✦ Blanchir fond</button></div>
<div id="btns">
  <button id="bc">Annuler</button>
  <button id="bk">Valider</button>
</div>
<div id="cropbtns">
  <button id="bcropcancel">✗ Annuler</button>
  <button id="bcropok">✓ Appliquer</button>
</div>
<canvas id="c"></canvas>
<script>
var img=document.getElementById('preview');
var cropCC=document.getElementById('crop-canvas');
var cropCtx=cropCC.getContext('2d');
var cropActive=false,cx=0,cy=0,cw=0,ch=0,dw=0,dh=0;
var activeH=null,msx=0,msy=0;
var HRAD=22,MINSZ=40;

function upd(){
  var b=document.getElementById('sb').value,c=document.getElementById('sc').value;
  var s=document.getElementById('ss').value,g=document.getElementById('sg').value;
  img.style.filter='brightness('+b+'%) contrast('+c+'%) saturate('+s+'%) grayscale('+g+'%)';
  document.getElementById('vb').textContent=b+'%';document.getElementById('vc').textContent=c+'%';
  document.getElementById('vs').textContent=s+'%';document.getElementById('vg').textContent=g+'%';
}
['sb','sc','ss','sg'].forEach(function(id){document.getElementById(id).addEventListener('input',upd)});

function resetSliders(){
  document.getElementById('sb').value=100;document.getElementById('sc').value=100;
  document.getElementById('ss').value=100;document.getElementById('sg').value=0;
  upd();
}

// ── Rotation ──────────────────────────────────────────────────────────────────
document.getElementById('brot').onclick=function(){
  if(!img.naturalWidth)return;
  var tc=document.createElement('canvas');
  tc.width=img.naturalHeight;tc.height=img.naturalWidth;
  var tx=tc.getContext('2d');
  tx.translate(tc.width/2,tc.height/2);tx.rotate(Math.PI/2);
  tx.drawImage(img,-img.naturalWidth/2,-img.naturalHeight/2);
  img.src=tc.toDataURL('image/jpeg',0.95);
  img.style.filter='none';resetSliders();
};

// ── Rognage ───────────────────────────────────────────────────────────────────
function drawCrop(){
  cropCtx.clearRect(0,0,dw,dh);
  cropCtx.fillStyle='rgba(0,0,0,0.55)';cropCtx.fillRect(0,0,dw,dh);
  cropCtx.clearRect(cx,cy,cw,ch);
  cropCtx.strokeStyle='#fff';cropCtx.lineWidth=1.5;cropCtx.strokeRect(cx,cy,cw,ch);
  cropCtx.strokeStyle='rgba(255,255,255,0.25)';cropCtx.lineWidth=1;
  for(var i=1;i<=2;i++){
    cropCtx.beginPath();cropCtx.moveTo(cx+cw*i/3,cy);cropCtx.lineTo(cx+cw*i/3,cy+ch);cropCtx.stroke();
    cropCtx.beginPath();cropCtx.moveTo(cx,cy+ch*i/3);cropCtx.lineTo(cx+cw,cy+ch*i/3);cropCtx.stroke();
  }
  [[cx,cy],[cx+cw,cy],[cx,cy+ch],[cx+cw,cy+ch]].forEach(function(h){
    cropCtx.beginPath();cropCtx.arc(h[0],h[1],10,0,Math.PI*2);
    cropCtx.fillStyle='#fff';cropCtx.fill();
    cropCtx.strokeStyle='rgba(0,0,0,0.4)';cropCtx.lineWidth=1;cropCtx.stroke();
  });
}

function enterCrop(){
  if(!img.naturalWidth)return;
  dw=img.offsetWidth;dh=img.offsetHeight;
  if(!dw||!dh)return;
  cropCC.width=dw;cropCC.height=dh;
  cropCC.style.width=dw+'px';cropCC.style.height=dh+'px';
  cropCC.style.display='block';
  var m=0.12;
  cx=Math.round(dw*m);cy=Math.round(dh*m);
  cw=Math.round(dw*(1-2*m));ch=Math.round(dh*(1-2*m));
  document.getElementById('controls').style.display='none';
  document.getElementById('toolrow').style.display='none';
  document.getElementById('bwrow').style.display='none';
  document.getElementById('btns').style.display='none';
  document.getElementById('cropbtns').style.display='flex';
  cropActive=true;drawCrop();
}

function exitCrop(apply){
  if(apply){
    var sx=img.naturalWidth/dw,sy=img.naturalHeight/dh;
    var tc=document.createElement('canvas');
    tc.width=Math.round(cw*sx);tc.height=Math.round(ch*sy);
    var tx=tc.getContext('2d');
    tx.drawImage(img,Math.round(cx*sx),Math.round(cy*sy),tc.width,tc.height,0,0,tc.width,tc.height);
    img.src=tc.toDataURL('image/jpeg',0.95);
    img.style.filter='none';resetSliders();
  }
  cropCC.style.display='none';cropActive=false;
  document.getElementById('controls').style.display='';
  document.getElementById('toolrow').style.display='';
  document.getElementById('bwrow').style.display='';
  document.getElementById('btns').style.display='';
  document.getElementById('cropbtns').style.display='none';
}

document.getElementById('bcrop').onclick=enterCrop;
document.getElementById('bcropok').onclick=function(){exitCrop(true);};
document.getElementById('bcropcancel').onclick=function(){exitCrop(false);};

function getPos(e){
  var r=cropCC.getBoundingClientRect();
  var t=e.touches?(e.touches[0]||e.changedTouches[0]):e;
  return{x:t.clientX-r.left,y:t.clientY-r.top};
}
function hitH(px,py){
  var corners=[[cx,cy],[cx+cw,cy],[cx,cy+ch],[cx+cw,cy+ch]];
  for(var i=0;i<4;i++){
    if(Math.abs(px-corners[i][0])<HRAD&&Math.abs(py-corners[i][1])<HRAD)return i;
  }
  if(px>cx&&px<cx+cw&&py>cy&&py<cy+ch)return 4;
  return null;
}
cropCC.addEventListener('touchstart',function(e){
  e.preventDefault();var p=getPos(e);activeH=hitH(p.x,p.y);
  if(activeH===4){msx=p.x-cx;msy=p.y-cy;}
},{passive:false});
cropCC.addEventListener('touchmove',function(e){
  e.preventDefault();if(activeH===null)return;
  var p=getPos(e);
  var px=Math.max(0,Math.min(dw,p.x)),py=Math.max(0,Math.min(dh,p.y));
  if(activeH===0){var nw=cx+cw-px,nh=cy+ch-py;if(nw>=MINSZ&&nh>=MINSZ){cx=px;cy=py;cw=nw;ch=nh;}}
  else if(activeH===1){var nw=px-cx,nh=cy+ch-py;if(nw>=MINSZ&&nh>=MINSZ){cy=py;cw=nw;ch=nh;}}
  else if(activeH===2){var nw=cx+cw-px,nh=py-cy;if(nw>=MINSZ&&nh>=MINSZ){cx=px;cw=nw;ch=nh;}}
  else if(activeH===3){var nw=px-cx,nh=py-cy;if(nw>=MINSZ&&nh>=MINSZ){cw=nw;ch=nh;}}
  else if(activeH===4){cx=Math.max(0,Math.min(dw-cw,px-msx));cy=Math.max(0,Math.min(dh-ch,py-msy));}
  drawCrop();
},{passive:false});
cropCC.addEventListener('touchend',function(e){e.preventDefault();activeH=null;},{passive:false});

// ── Blanchir ──────────────────────────────────────────────────────────────────
document.getElementById('bbw').onclick=function(){
  if(!img.naturalWidth)return;
  var tc=document.createElement('canvas');tc.width=img.naturalWidth;tc.height=img.naturalHeight;
  var tx=tc.getContext('2d');tx.drawImage(img,0,0);
  var id=tx.getImageData(0,0,tc.width,tc.height);var px=id.data;
  var hist=new Array(256).fill(0);
  for(var i=0;i<px.length;i+=4)hist[Math.round(0.2126*px[i]+0.7152*px[i+1]+0.0722*px[i+2])]++;
  var total=px.length/4,cumul=0,paper=255;
  for(var l=255;l>=0;l--){cumul+=hist[l];if(cumul/total>0.1){paper=l;break;}}
  if(paper<128)paper=200;
  var sc2=255/Math.max(1,paper);
  for(var i=0;i<px.length;i+=4){
    var r=Math.min(255,px[i]*sc2),g=Math.min(255,px[i+1]*sc2),b=Math.min(255,px[i+2]*sc2);
    var gy=0.2126*r+0.7152*g+0.0722*b;
    px[i]=Math.max(0,Math.min(255,gy*0.35+r*0.65));
    px[i+1]=Math.max(0,Math.min(255,gy*0.35+g*0.65));
    px[i+2]=Math.max(0,Math.min(255,gy*0.35+b*0.65));
  }
  tx.putImageData(id,0,0);img.src=tc.toDataURL('image/jpeg',0.95);
  img.style.filter='none';resetSliders();
};

// ── Annuler / Valider ─────────────────────────────────────────────────────────
document.getElementById('bc').onclick=function(){
  window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({t:'cancel'}));
};
document.getElementById('bk').onclick=function(){
  if(!img.naturalWidth)return;
  var cv=document.getElementById('c');cv.width=img.naturalWidth;cv.height=img.naturalHeight;
  var ctx=cv.getContext('2d');ctx.drawImage(img,0,0);
  var br=parseFloat(document.getElementById('sb').value)/100;
  var co=parseFloat(document.getElementById('sc').value)/100;
  var sa=parseFloat(document.getElementById('ss').value)/100;
  var gr=parseFloat(document.getElementById('sg').value)/100;
  var id=ctx.getImageData(0,0,cv.width,cv.height);var px=id.data;
  for(var i=0;i<px.length;i+=4){
    var r=px[i],g=px[i+1],b=px[i+2];
    r=r*br;g=g*br;b=b*br;
    r=(r/255-0.5)*co+0.5;g=(g/255-0.5)*co+0.5;b=(b/255-0.5)*co+0.5;
    r=r*255;g=g*255;b=b*255;
    var lum=0.2126*r+0.7152*g+0.0722*b;
    r=lum+sa*(r-lum);g=lum+sa*(g-lum);b=lum+sa*(b-lum);
    var gy=0.2126*r+0.7152*g+0.0722*b;
    r=r+(gy-r)*gr;g=g+(gy-g)*gr;b=b+(gy-b)*gr;
    px[i]=Math.max(0,Math.min(255,r));px[i+1]=Math.max(0,Math.min(255,g));px[i+2]=Math.max(0,Math.min(255,b));
  }
  ctx.putImageData(id,0,0);
  var out=cv.toDataURL('image/jpeg',0.9).split(',')[1];
  if(!out){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({t:'cancel'}));return;}
  window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({t:'ok',b64:out}));
};

img.src='data:image/jpeg;base64,${b64clean}';
</script>
</body></html>`;
}

// ── Storage key ───────────────────────────────────────────────────────────────

const acquisStorageKey = (cardId: string) => `revision_acquis_${cardId}`;

// ── Scanner modal ─────────────────────────────────────────────────────────────

type ScanStep = "preview" | "uploading" | "error";

type ScanFlashModalProps = {
  visible: boolean;
  card: Card;
  onClose: () => void;
  onDone: (newFlash: UserFlash) => void;
};

function ScanFlashModal({ visible, card, onClose, onDone }: ScanFlashModalProps) {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const thumbSize = (screenWidth - 64) / 2;

  const [rectoUri, setRectoUri] = useState<string | null>(null);
  const [versoUri, setVersoUri] = useState<string | null>(null);
  const [step, setStep] = useState<ScanStep>("preview");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [editingFor, setEditingFor] = useState<"recto" | "verso" | null>(null);
  const [editorHtml, setEditorHtml] = useState<string | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editedRectoUri, setEditedRectoUri] = useState<string | null>(null);
  const [editedVersoUri, setEditedVersoUri] = useState<string | null>(null);
  const editorDoneRef = useRef(false);

  const closeEditor = () => {
    setEditingFor(null);
    setEditorHtml(null);
  };

  const openEditor = async (side: "recto" | "verso") => {
    const uri = side === "recto" ? rectoUri : versoUri;
    if (!uri) return;
    editorDoneRef.current = false;
    setEditorHtml(null);
    setEditingFor(side);
    setEditorLoading(true);
    try {
      // Réduire à 600px (taille cible finale) pour limiter le postMessage
      const small = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 600 } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );
      const path = small.uri.startsWith("file://") ? small.uri.slice(7) : small.uri;
      const b64 = await RNBlobUtil.fs.readFile(path, "base64");
      setEditorHtml(buildEditorHtml(b64.replace(/[\r\n]/g, "")));
    } catch {
      closeEditor();
    } finally {
      setEditorLoading(false);
    }
  };

  const reset = () => {
    setRectoUri(null);
    setVersoUri(null);
    setStep("preview");
    setProgress("");
    setError("");
    closeEditor();
    setEditedRectoUri(null);
    setEditedVersoUri(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const scanSide = async (side: "recto" | "verso") => {
    try {
      const { scannedImages } = await DocumentScanner.scanDocument({ maxNumDocuments: 1 });
      if (!scannedImages?.length) return;
      const uri = scannedImages[0];
      if (side === "recto") {
        setRectoUri(uri);
        setEditedRectoUri(null);
      } else {
        setVersoUri(uri);
        setEditedVersoUri(null);
      }
    } catch {}
  };

  const upload = async () => {
    if (!rectoUri) return;
    setStep("uploading");
    setProgress("Redimensionnement...");
    try {
      const resizedRecto = await ImageManipulator.manipulateAsync(
        editedRectoUri ?? rectoUri,
        [{ resize: { width: 600 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      const resizedVerso = versoUri
        ? await ImageManipulator.manipulateAsync(
            editedVersoUri ?? versoUri,
            [{ resize: { width: 600 } }],
            { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
          )
        : null;

      setProgress("Envoi du recto...");
      const rectoFilename = `recto_${Date.now()}.jpg`;
      const rectoSignedRes = await apiFetch("/userflashes/signed-url", {
        method: "POST",
        body: JSON.stringify({ cardId: card._id, side: "recto", filename: rectoFilename }),
      });
      if (!rectoSignedRes.ok) throw new Error("Erreur signed URL recto");
      const { signedUrl: rectoSignedUrl, filename: rectoGcsFilename } =
        await rectoSignedRes.json();
      const rectoUpload = await RNBlobUtil.fetch(
        "PUT",
        rectoSignedUrl,
        { "Content-Type": "image/jpeg" },
        RNBlobUtil.wrap(resizedRecto.uri.replace("file://", ""))
      );
      if (rectoUpload.respInfo.status >= 400) throw new Error("Échec upload recto");

      let versoGcsFilename: string | undefined;
      if (resizedVerso) {
        setProgress("Envoi du verso...");
        const versoFilename = `verso_${Date.now()}.jpg`;
        const versoSignedRes = await apiFetch("/userflashes/signed-url", {
          method: "POST",
          body: JSON.stringify({ cardId: card._id, side: "verso", filename: versoFilename }),
        });
        if (!versoSignedRes.ok) throw new Error("Erreur signed URL verso");
        const { signedUrl: versoSignedUrl, filename: vGcsFilename } =
          await versoSignedRes.json();
        const versoUpload = await RNBlobUtil.fetch(
          "PUT",
          versoSignedUrl,
          { "Content-Type": "image/jpeg" },
          RNBlobUtil.wrap(resizedVerso.uri.replace("file://", ""))
        );
        if (versoUpload.respInfo.status >= 400) throw new Error("Échec upload verso");
        versoGcsFilename = vGcsFilename;
      }

      setProgress("Enregistrement...");
      const confirmRes = await apiFetch("/userflashes/confirm", {
        method: "POST",
        body: JSON.stringify({
          cardId: card._id,
          rectoFilename: rectoGcsFilename,
          versoFilename: versoGcsFilename,
        }),
      });
      if (!confirmRes.ok) throw new Error("Erreur enregistrement");
      const { flash: newFlash } = await confirmRes.json();

      reset();
      onDone(newFlash);
    } catch (err: any) {
      setError(err?.message || "Une erreur est survenue");
      setStep("error");
    }
  };

  const renderThumb = (side: "recto" | "verso") => {
    const isRecto = side === "recto";
    const displayUri = isRecto ? (editedRectoUri ?? rectoUri) : (editedVersoUri ?? versoUri);
    const label = isRecto ? "Recto *" : "Verso (optionnel)";
    const isEdited = isRecto ? !!editedRectoUri : !!editedVersoUri;

    return (
      <View key={side} style={{ width: thumbSize, height: thumbSize }}>
        <TouchableOpacity
          style={[
            scanStyles.thumbBox,
            { width: thumbSize, height: thumbSize, borderColor: colors.flash as string },
          ]}
          onPress={() => scanSide(side)}
        >
          {displayUri ? (
            <Image
              source={{ uri: displayUri }}
              style={{ width: thumbSize, height: thumbSize, borderRadius: 10 }}
            />
          ) : (
            <View style={scanStyles.thumbPlaceholder}>
              <Ionicons name="scan-outline" size={32} color={colors.muted as string} />
              <AppText style={{ color: colors.muted as string, fontSize: 13, marginTop: 6 }}>
                {label}
              </AppText>
            </View>
          )}
        </TouchableOpacity>

        {displayUri && (
          <>
            {isEdited && (
              <View style={scanStyles.editedBadge}>
                <Ionicons name="color-wand" size={10} color="#fff" />
              </View>
            )}
            <TouchableOpacity
              style={scanStyles.editIcon}
              onPress={() => openEditor(side)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="color-wand-outline" size={18} color="#fff" />
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={scanStyles.overlay}>
        <View style={[scanStyles.sheet, { backgroundColor: colors.bgflash }]}>
          <View style={[scanStyles.header, { backgroundColor: colors.flash as string }]}>
            <AppText style={[scanStyles.headerTitle, { color: colors.text }]}>
              {step === "uploading" ? progress : "Nouvelle carte"}
            </AppText>
            <TouchableOpacity onPress={handleClose} style={scanStyles.closeBtn}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>

          {step === "preview" && (
            <View style={scanStyles.body}>
              <View style={scanStyles.thumbRow}>
                {renderThumb("recto")}
                {renderThumb("verso")}
              </View>

              <AppText style={{ color: colors.textSecondary as string, fontSize: 12, textAlign: "center" }}>
                Appuyez sur une case pour scanner · sur l'icône pour retoucher
              </AppText>

              <View style={scanStyles.actions}>
                {rectoUri && (
                  <TouchableOpacity
                    style={[scanStyles.btn, { backgroundColor: colors.boutonyes as string }]}
                    onPress={upload}
                  >
                    <Ionicons name="cloud-upload-outline" size={20} color={colors.text} />
                    <AppText style={[scanStyles.btnText, { color: colors.text }]}>
                      Enregistrer
                    </AppText>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {step === "uploading" && (
            <View style={[scanStyles.body, scanStyles.center]}>
              <ActivityIndicator size="large" color={colors.primary as string} />
            </View>
          )}

          {step === "error" && (
            <View style={[scanStyles.body, scanStyles.center]}>
              <Ionicons name="alert-circle-outline" size={48} color="#e74c3c" />
              <AppText style={{ color: colors.text, fontSize: 15, textAlign: "center", marginVertical: 12 }}>
                {error}
              </AppText>
              <TouchableOpacity
                style={[scanStyles.btn, { backgroundColor: colors.flash as string }]}
                onPress={() => setStep("preview")}
              >
                <AppText style={[scanStyles.btnText, { color: colors.text }]}>Réessayer</AppText>
              </TouchableOpacity>
            </View>
          )}

          {/* Éditeur d'image : overlay inline dans la même modale */}
          {editingFor !== null && (
            <View style={scanStyles.editorOverlay}>
              {editorLoading && (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <ActivityIndicator color="#fff" size="large" />
                </View>
              )}
              {editorHtml && !editorLoading && (
                <WebView
                  source={{ html: editorHtml }}
                  style={{ flex: 1 }}
                  scrollEnabled={false}
                  onMessage={(event) => {
                    if (editorDoneRef.current) return;
                    try {
                      const data = JSON.parse(event.nativeEvent.data);
                      if (data.t === "cancel") {
                        closeEditor();
                      } else if (data.t === "ok") {
                        editorDoneRef.current = true;
                        const tempPath = `${RNBlobUtil.fs.dirs.CacheDir}/edited_${Date.now()}.jpg`;
                        RNBlobUtil.fs
                          .writeFile(tempPath, data.b64, "base64")
                          .then(() => {
                            if (editingFor === "recto") setEditedRectoUri(`file://${tempPath}`);
                            else setEditedVersoUri(`file://${tempPath}`);
                            closeEditor();
                          })
                          .catch(() => closeEditor());
                      }
                    } catch {
                      closeEditor();
                    }
                  }}
                />
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const scanStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    flex: 1,
    marginTop: Platform.OS === "ios" ? "13%" : "1%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    paddingTop: 24,
  },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  closeBtn: { padding: 4 },
  body: { flex: 1, padding: 20, gap: 16 },
  center: { alignItems: "center", justifyContent: "center" },
  thumbRow: { flexDirection: "row", gap: 16, justifyContent: "center" },
  thumbBox: {
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    overflow: "hidden",
  },
  thumbPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  editIcon: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  editedBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#4a90d9",
    alignItems: "center",
    justifyContent: "center",
  },
  actions: { gap: 12 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  btnText: { fontSize: 16, fontWeight: "600" },
  editorOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#1a1a1a",
    zIndex: 10,
  },
});

// ── Main component ─────────────────────────────────────────────────────────────

type Props = {
  card: Card;
  onClose: () => void;
  onCurrentChange?: (current: number, total: number) => void;
};

export default function RevisionBlock({ card, onCurrentChange }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();

  const webviewRef = useRef<WebView>(null);
  const currentRef = useRef(0);
  const sideRef = useRef<"recto" | "verso">("recto");
  const acquisRef = useRef<Set<string>>(new Set());
  const deckRef = useRef<UserFlash[]>([]);
  const allFlashRef = useRef<UserFlash[]>([]);

  const [allFlash, setAllFlash] = useState<UserFlash[]>([]);
  const [userPrefix, setUserPrefix] = useState<string>("");
  const [deck, setDeck] = useState<UserFlash[]>([]);
  const [current, setCurrent] = useState(0);
  const [side, setSide] = useState<"recto" | "verso">("recto");
  const [acquis, setAcquis] = useState<Set<string>>(new Set());
  const [cardHeight, setCardHeight] = useState(300);
  const [wrapperHeight, setWrapperHeight] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scanVisible, setScanVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  currentRef.current = current;
  sideRef.current = side;
  acquisRef.current = acquis;
  deckRef.current = deck;
  allFlashRef.current = allFlash;

  // Fetch userflashes and load acquis
  const fetchFlashes = useCallback(async (keepAcquis?: Set<string>) => {
    if (!card._id) { setLoading(false); return; }
    try {
      const [flashRes, storageRaw] = await Promise.all([
        apiFetch(`/userflashes?cardId=${card._id}`),
        keepAcquis !== undefined
          ? Promise.resolve(null)
          : storageGet(acquisStorageKey(card._id)),
      ]);

      const data = flashRes.ok ? await flashRes.json() : { flash: [], userPrefix: "" };
      const flashes: UserFlash[] = data.flash ?? [];
      const prefix: string = data.userPrefix ?? "";

      let acquisSet = keepAcquis ?? new Set<string>();
      if (!keepAcquis && storageRaw) {
        try { acquisSet = new Set<string>(JSON.parse(storageRaw)); } catch {}
      }

      acquisRef.current = acquisSet;
      allFlashRef.current = flashes;
      setAllFlash(flashes);
      setUserPrefix(prefix);
      setAcquis(acquisSet);
      setDeck(shuffle(flashes));
      setCurrent(0);
      setSide("recto");
      setCardHeight(300);
    } catch {}
    setLoading(false);
  }, [card._id]);

  useEffect(() => {
    fetchFlashes();
  }, [fetchFlashes]);

  // Notify parent of progress
  const allFlashActiveIdx = allFlash.findIndex((fi) => fi.id === deck[current]?.id);
  useEffect(() => {
    if (allFlash.length > 0) onCurrentChange?.(allFlashActiveIdx, allFlash.length);
  }, [allFlashActiveIdx, allFlash.length, onCurrentChange]);

  // Persist acquis changes
  useEffect(() => {
    if (loading || !card._id) return;
    storageSet(acquisStorageKey(card._id), JSON.stringify([...acquis]));
  }, [acquis, loading, card._id]);

  const injectCurrentSide = useCallback(() => {
    webviewRef.current?.injectJavaScript(`flip('${sideRef.current}');true;`);
  }, []);

  const goTo = useCallback((idx: number) => {
    if (idx < 0) return;
    const d = deckRef.current;
    if (idx >= d.length) {
      const nonAcquis = allFlashRef.current.filter((fi) => !acquisRef.current.has(fi.id));
      const acquisList = allFlashRef.current.filter((fi) => acquisRef.current.has(fi.id));
      if (nonAcquis.length === 0) {
        setDeck(shuffle([...allFlashRef.current]));
      } else if (acquisList.length === 0) {
        setDeck(shuffle(nonAcquis));
      } else {
        const randomAcquired = acquisList[Math.floor(Math.random() * acquisList.length)];
        setDeck(shuffle([...nonAcquis, randomAcquired]));
      }
      setCurrent(0);
      setSide("recto");
      setCardHeight(300);
      return;
    }
    setCardHeight(300);
    setSide("recto");
    setCurrent(idx);
  }, []);

  const markAcquis = useCallback(() => {
    const f = deckRef.current[currentRef.current];
    if (!f) return;
    const next = new Set(acquisRef.current);
    if (next.has(f.id)) {
      next.delete(f.id);
    } else {
      next.add(f.id);
    }
    acquisRef.current = next;
    setAcquis(next);
  }, []);

  const handleReset = useCallback(() => {
    acquisRef.current = new Set();
    setAcquis(new Set());
    if (card._id) storageDelete(acquisStorageKey(card._id));
    setDeck(shuffle(allFlashRef.current));
    setCurrent(0);
    setSide("recto");
    setCardHeight(300);
  }, [card._id]);

  const flipTo = useCallback((newSide: "recto" | "verso") => {
    if (newSide === sideRef.current) return;
    sideRef.current = newSide;
    setSide(newSide);
    webviewRef.current?.injectJavaScript(`flip('${newSide}');true;`);
  }, []);

  const handleDelete = useCallback(() => {
    const f = deckRef.current[currentRef.current];
    if (!f) return;
    Alert.alert(
      "Supprimer cette carte ?",
      "Cette action est irréversible.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              const res = await apiFetch(
                `/userflashes/${f.id}?cardId=${card._id}`,
                { method: "DELETE" }
              );
              if (!res.ok) throw new Error();
              const nextAll = allFlashRef.current.filter((fi) => fi.id !== f.id);
              const nextAcquis = new Set(acquisRef.current);
              nextAcquis.delete(f.id);
              allFlashRef.current = nextAll;
              acquisRef.current = nextAcquis;
              setAllFlash(nextAll);
              setAcquis(nextAcquis);
              const nextDeck = deckRef.current.filter((fi) => fi.id !== f.id);
              setDeck(nextDeck);
              const newIdx = Math.min(currentRef.current, nextDeck.length - 1);
              setCurrent(Math.max(0, newIdx));
              setSide("recto");
              setCardHeight(300);
            } catch {
              Alert.alert("Erreur", "Impossible de supprimer la carte.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }, [card._id]);

  const handleScanDone = useCallback((newFlash: UserFlash) => {
    setScanVisible(false);
    const nextAll = [...allFlashRef.current, newFlash];
    allFlashRef.current = nextAll;
    setAllFlash(nextAll);
    const newCardIdx = deckRef.current.length;
    setDeck((prev) => [...prev, newFlash]);
    setCurrent(newCardIdx);
    setSide("recto");
    setCardHeight(300);
  }, []);

  const swipeGesture = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-25, 25])
    .failOffsetY([-15, 15])
    .onEnd((event) => {
      if (event.translationX < -50) goTo(currentRef.current + 1);
      else if (event.translationX > 50) goTo(currentRef.current - 1);
    });

  // ── Progress bars ─────────────────────────────────────────────────────────

  const BAR_GAP = 6;
  const MAX_VISIBLE = 8;
  const RESET_WIDTH = 48;
  const availableWidth = screenWidth - 32 - RESET_WIDTH;
  const n = Math.max(1, Math.min(allFlash.length, MAX_VISIBLE));
  const barWidth = Math.max(20, (availableWidth - BAR_GAP * (n - 1)) / n);

  const getBarBg = useCallback(
    (fi: UserFlash): string =>
      acquis.has(fi.id) ? (colors.boutonyes as string) : (colors.muted as string),
    [acquis, colors]
  );

  // ── Current card HTML ─────────────────────────────────────────────────────

  const f = deck[current];

  const rectoUrl = useMemo(() => {
    if (!f?.imquestion || !user?.directoryname || !userPrefix) return "";
    return buildCardUserFlashImageUrl({
      directoryname: user.directoryname,
      repertoire: card.repertoire,
      num: card.num,
      userPrefix,
      filename: f.imquestion,
    });
  }, [f?.id, f?.imquestion, user?.directoryname, userPrefix, card.repertoire, card.num]); // eslint-disable-line react-hooks/exhaustive-deps

  const versoUrl = useMemo(() => {
    if (!f?.imreponse || !user?.directoryname || !userPrefix) return "";
    return buildCardUserFlashImageUrl({
      directoryname: user.directoryname,
      repertoire: card.repertoire,
      num: card.num,
      userPrefix,
      filename: f.imreponse,
    });
  }, [f?.id, f?.imreponse, user?.directoryname, userPrefix, card.repertoire, card.num]); // eslint-disable-line react-hooks/exhaustive-deps

  const cardHtml = useMemo(
    () =>
      f
        ? buildUserFlashHtml(
            rectoUrl,
            versoUrl,
            colors.bgflash as string,
            colors.text as string,
            "transparent",
          )
        : "",
    [f?.id, rectoUrl, versoUrl, colors.bgflash, colors.text] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const nonAcquisCount = useMemo(
    () => allFlash.filter((fi) => !acquis.has(fi.id)).length,
    [allFlash, acquis]
  );

  const canAdd =
    !card.nbUserFlashes || allFlash.length < card.nbUserFlashes;

  // ── Early returns ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary as string} />
      </View>
    );
  }

  const bgFlash = colors.bgflash as string;

  // ── Empty state ───────────────────────────────────────────────────────────

  if (allFlash.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: bgFlash }]}>
        <Ionicons name="albums-outline" size={56} color={colors.muted as string} />
        <AppText style={{ color: colors.muted as string, fontSize: 16, marginTop: 12, textAlign: "center" }}>
          Vous n'avez pas encore de cartes.
        </AppText>
        {canAdd && (
          <TouchableOpacity
            style={[styles.addEmptyBtn, { backgroundColor: colors.flash as string }]}
            onPress={() => setScanVisible(true)}
          >
            <Ionicons name="add" size={22} color={colors.text} />
            <AppText style={{ color: colors.text, fontWeight: "600", fontSize: 15 }}>
              Créer ma première carte
            </AppText>
          </TouchableOpacity>
        )}
        <ScanFlashModal
          visible={scanVisible}
          card={card}
          onClose={() => setScanVisible(false)}
          onDone={handleScanDone}
        />
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: bgFlash }]}>

      {/* Progress bars */}
      <View style={styles.progressRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.barsContent, { gap: BAR_GAP }]}
          style={styles.barsScroll}
        >
          {allFlash.map((fi, idx) => {
            const deckIdx = deck.findIndex((d) => d.id === fi.id);
            return (
              <TouchableOpacity
                key={fi.id}
                onPress={() => {
                  if (deckIdx >= 0) {
                    setCardHeight(300);
                    setSide("recto");
                    setCurrent(deckIdx);
                  } else {
                    const newDeck = [...deckRef.current];
                    const insertAt = currentRef.current + 1;
                    newDeck.splice(insertAt, 0, fi);
                    deckRef.current = newDeck;
                    setDeck(newDeck);
                    setCardHeight(300);
                    setSide("recto");
                    setCurrent(insertAt);
                  }
                }}
                hitSlop={{ top: 16, bottom: 16, left: 4, right: 4 }}
                style={[
                  styles.bar,
                  {
                    width: barWidth,
                    backgroundColor: getBarBg(fi),
                    borderWidth: idx === allFlashActiveIdx ? 1.5 : 0,
                    borderColor: colors.text as string,
                  },
                ]}
              />
            );
          })}
        </ScrollView>
        <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
          <Ionicons name="refresh-outline" size={22} color={colors.textSecondary as string} />
        </TouchableOpacity>
      </View>

      {/* Non-acquis counter */}
      <AppText style={[styles.toReviewText, { color: colors.textSecondary as string }]}>
        {nonAcquisCount > 0 ? `${nonAcquisCount} à revoir` : "Tout acquis !"}
      </AppText>

      {/* Recto / Verso toggle */}
      <View style={styles.faceBtns}>
        <TouchableOpacity
          style={[
            styles.faceBtn,
            side === "recto" && { backgroundColor: colors.flash as string },
          ]}
          onPress={() => flipTo("recto")}
        >
          <AppText
            style={[
              styles.faceBtnText,
              { color: side === "recto" ? (colors.text as string) : (colors.muted as string) },
            ]}
          >
            Recto
          </AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.faceBtn,
            side === "verso" && { backgroundColor: colors.flash as string },
          ]}
          onPress={() => flipTo("verso")}
        >
          <AppText
            style={[
              styles.faceBtnText,
              { color: side === "verso" ? (colors.text as string) : (colors.muted as string) },
            ]}
          >
            Verso
          </AppText>
        </TouchableOpacity>
      </View>

      {/* Card content */}
      <GestureDetector gesture={swipeGesture}>
        <View style={styles.cardWrapper} onLayout={(e) => setWrapperHeight(e.nativeEvent.layout.height)}>
          <ScrollView
            style={[styles.cardScroll, { backgroundColor: bgFlash }]}
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ height: cardHeight, backgroundColor: bgFlash }}>
              <WebView
                ref={webviewRef}
                key={f?.id ?? "empty"}
                source={{ html: cardHtml }}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
                style={{ flex: 1, backgroundColor: "transparent" }}
                onMessage={(event) => {
                  try {
                    const data = JSON.parse(event.nativeEvent.data);
                    if (data.t === "load") {
                      if (data.h > 0) setCardHeight(data.h + 24);
                      injectCurrentSide();
                    } else if (data.t === "flip") {
                      flipTo(sideRef.current === "recto" ? "verso" : "recto");
                    }
                  } catch {}
                }}
              />
            </View>
          </ScrollView>

          {/* NavZone : juste sous la carte, tap = carte suivante */}
          {wrapperHeight > 0 && Math.ceil((wrapperHeight + cardHeight) / 2) < wrapperHeight && (
            <TouchableOpacity
              style={{
                position: "absolute",
                top: Math.ceil((wrapperHeight + cardHeight) / 2),
                left: 0,
                right: 0,
                bottom: 0,
              }}
              onPress={() => goTo(currentRef.current + 1)}
              activeOpacity={1}
            />
          )}
        </View>
      </GestureDetector>

      {/* Suivant */}
      <View style={styles.suivantRow}>
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: `${colors.flash as string}80` }]}
          onPress={() => goTo(currentRef.current + 1)}
        >
          <AppText style={[styles.footerBtnText, { color: colors.text as string }]}>
            Suivant
          </AppText>
          <Ionicons name="arrow-forward" size={20} color={colors.text as string} />
        </TouchableOpacity>
      </View>

      {/* Footer: Acquis + Add + Delete */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.acquisBtn, {
            backgroundColor: f && acquis.has(f.id)
              ? (colors.boutonyes as string)
              : `${colors.flash as string}80`,
          }]}
          onPress={markAcquis}
        >
          <Ionicons name="checkmark" size={20} color={colors.text as string} />
          <AppText style={[styles.footerBtnText, { color: colors.text as string }]}>
            Acquis
          </AppText>
        </TouchableOpacity>

        {canAdd && (
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: `${colors.flash as string}80` }]}
            onPress={() => setScanVisible(true)}
          >
            <Ionicons name="add" size={24} color={colors.text as string} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: `${colors.boutonno as string}80` }]}
          onPress={handleDelete}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator size="small" color={colors.text as string} />
          ) : (
            <Ionicons name="trash-outline" size={22} color={colors.text as string} />
          )}
        </TouchableOpacity>
      </View>

      <ScanFlashModal
        visible={scanVisible}
        card={card}
        onClose={() => setScanVisible(false)}
        onDone={handleScanDone}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  barsScroll: { flex: 1 },
  barsContent: { flexDirection: "row", alignItems: "center" },
  bar: { height: 12, borderRadius: 6 },
  resetBtn: { padding: 8, marginLeft: 8 },
  toReviewText: {
    fontSize: 12,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  faceBtns: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 2,
    marginTop: 40,
    gap: 10,
    justifyContent: "center",
  },
  faceBtn: {
    paddingVertical: 7,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  faceBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  cardWrapper: { flex: 1, position: "relative" },
  cardScroll: { flex: 1 },
  footer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  acquisBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  suivantRow: {
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  footerBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  addEmptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    marginTop: 8,
  },
});
