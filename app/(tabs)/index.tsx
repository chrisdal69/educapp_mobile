import { View, StyleSheet } from 'react-native';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/utils/apiClient';
import Repertoires from '@/components/Repertoires';
import Cards from '@/components/Cards';
import TabList from '@/components/TabList';
import type { Card, ClasseRepertoire } from '@/types/cards';

export default function Index() {
  const { user } = useAuth();
  const [cards, setCards] = useState<Card[]>([]);
  const [repertoires, setRepertoires] = useState<ClasseRepertoire[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [selectedRepertoire, setSelectedRepertoire] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  useEffect(() => {
    if (!user?.classId) return;
    setStatus('loading');
    apiFetch(`/cards?classId=${encodeURIComponent(user.classId)}`)
      .then((r) => r.json())
      .then((data) => {
        const fetched: Card[] = data.result ?? [];
        setCards(fetched);
        setRepertoires(data.repertoires ?? []);
        setStatus('idle');
      })
      .catch(() => setStatus('error'));
  }, [user?.classId]);

  return (
    <View style={styles.container}>
      <Repertoires
        repertoires={repertoires}
        selected={selectedRepertoire}
        onSelect={setSelectedRepertoire}
      />
      <Cards
        cards={cards}
        selectedRepertoire={selectedRepertoire}
        selectedCard={selectedCard}
        onSelect={setSelectedCard}
      />
      <TabList
        selectedCard={selectedCard}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25292e',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
