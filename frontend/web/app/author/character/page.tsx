'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './page.module.css';

interface Character {
  id: string;
  name: string;
  role: string;
  background: string;
  personality: string;
  goals: string[];
  relationships: string[];
}

interface Story {
  id: string;
  title: string;
}

export default function CharacterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storyId = searchParams.get('storyId');
  const characterId = searchParams.get('id');

  const [character, setCharacter] = useState<Character>({
    id: '',
    name: '',
    role: '',
    background: '',
    personality: '',
    goals: [''],
    relationships: ['']
  });
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (storyId) {
      fetchStory();
    }
    if (characterId) {
      fetchCharacter();
    }
  }, [storyId, characterId]);

  const fetchStory = async () => {
    try {
      const response = await fetch(`/api/stories/${storyId}`);
      if (!response.ok) throw new Error('获取故事信息失败');
      const data = await response.json();
      setStory(data);
    } catch (err) {
      console.error('获取故事信息失败:', err);
    }
  };

  const fetchCharacter = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/ai/characters/${characterId}`);
      if (!response.ok) throw new Error('获取角色失败');
      const data = await response.json();
      setCharacter(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取角色失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storyId) {
      setError('未找到故事ID');
      return;
    }

    try {
      setLoading(true);
      const url = characterId 
        ? `/api/ai/characters/${characterId}`
        : '/api/ai/characters';
      
      const method = characterId ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...character,
          storyId
        }),
      });

      if (!response.ok) throw new Error('保存角色失败');
      
      const data = await response.json();
      router.push(`/author/story?id=${storyId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存角色失败');
    } finally {
      setLoading(false);
    }
  };

  const handleArrayChange = (
    field: 'goals' | 'relationships',
    index: number,
    value: string
  ) => {
    const newArray = [...character[field]];
    newArray[index] = value;
    setCharacter(prev => ({ ...prev, [field]: newArray }));
  };

  const addArrayItem = (field: 'goals' | 'relationships') => {
    setCharacter(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }));
  };

  const removeArrayItem = (
    field: 'goals' | 'relationships',
    index: number
  ) => {
    setCharacter(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  if (loading) return <div className={styles.container}>加载中...</div>;
  if (!storyId) return <div className={styles.container}>未找到故事ID</div>;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>
        {characterId ? '编辑角色' : '创建新角色'}
      </h1>
      
      {story && (
        <div className={styles.storyTitle}>
          所属故事：{story.title}
        </div>
      )}
      
      {error && <div className={styles.error}>{error}</div>}
      
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="name">角色名称</label>
          <input
            type="text"
            id="name"
            value={character.name}
            onChange={e => setCharacter(prev => ({ ...prev, name: e.target.value }))}
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="role">角色身份</label>
          <input
            type="text"
            id="role"
            value={character.role}
            onChange={e => setCharacter(prev => ({ ...prev, role: e.target.value }))}
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="background">背景故事</label>
          <textarea
            id="background"
            value={character.background}
            onChange={e => setCharacter(prev => ({ ...prev, background: e.target.value }))}
            rows={4}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="personality">性格特征</label>
          <textarea
            id="personality"
            value={character.personality}
            onChange={e => setCharacter(prev => ({ ...prev, personality: e.target.value }))}
            rows={4}
          />
        </div>

        <div className={styles.formGroup}>
          <label>目标</label>
          {character.goals.map((goal, index) => (
            <div key={index} className={styles.arrayItem}>
              <input
                type="text"
                value={goal}
                onChange={e => handleArrayChange('goals', index, e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeArrayItem('goals', index)}
                className={styles.removeButton}
              >
                删除
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => addArrayItem('goals')}
            className={styles.addButton}
          >
            添加目标
          </button>
        </div>

        <div className={styles.formGroup}>
          <label>关系网络</label>
          {character.relationships.map((relationship, index) => (
            <div key={index} className={styles.arrayItem}>
              <input
                type="text"
                value={relationship}
                onChange={e => handleArrayChange('relationships', index, e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeArrayItem('relationships', index)}
                className={styles.removeButton}
              >
                删除
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => addArrayItem('relationships')}
            className={styles.addButton}
          >
            添加关系
          </button>
        </div>

        <div className={styles.buttonGroup}>
          <button type="submit" className={styles.submitButton}>
            {characterId ? '保存修改' : '创建角色'}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/author/story?id=${storyId}`)}
            className={styles.cancelButton}
          >
            取消
          </button>
        </div>
      </form>
    </div>
  );
}
