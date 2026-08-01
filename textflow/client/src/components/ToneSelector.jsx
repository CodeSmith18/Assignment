import React from 'react';

const TONES = [
  { id: 'default', label: 'Default', description: 'Standard AI paraphrase rewriting.', premium: false },
  { id: 'professional', label: 'Professional', description: 'Business-appropriate, formal language.', premium: true },
  { id: 'casual', label: 'Casual', description: 'Friendly, conversational tone.', premium: true },
  { id: 'academic', label: 'Academic', description: 'Scholarly, precise articulation.', premium: true },
  { id: 'creative', label: 'Creative', description: 'Engaging, varied and artistic phrasing.', premium: true }
];

export default function ToneSelector({ selectedTone, onToneSelect, isPro, onUpgradePrompt }) {
  const handleSelect = (tone) => {
    if (tone.premium && !isPro) {
      // Trigger the upgrade prompt/modal
      onUpgradePrompt();
    } else {
      onToneSelect(tone.id);
    }
  };

  return (
    <div className="tone-selector-container">
      <label className="section-label">Select Rewrite Tone</label>
      <div className="tone-grid">
        {TONES.map((t) => {
          const isSelected = selectedTone === t.id;
          const isLocked = t.premium && !isPro;

          return (
            <button
              key={t.id}
              type="button"
              className={`tone-card ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''}`}
              onClick={() => handleSelect(t)}
              title={t.description}
            >
              <div className="tone-card-header">
                <span className="tone-label">{t.label}</span>
                {isLocked && <span className="pro-badge">PRO</span>}
              </div>
              <p className="tone-description">{t.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
