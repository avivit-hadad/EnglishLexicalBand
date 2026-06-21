function loadVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis.getVoices();
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

const GRANDPA_VOICE_HINTS = [
  'david',
  'daniel',
  'james',
  'fred',
  'mark',
  'paul',
  'george',
  'microsoft david',
  'microsoft mark',
  'google uk english male',
  'english united kingdom',
  'en-gb',
  'male',
];

function pickGrandpaVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => v.lang.startsWith('en'));
  if (english.length === 0) return voices[0] ?? null;

  for (const hint of GRANDPA_VOICE_HINTS) {
    const match = english.find((v) => v.name.toLowerCase().includes(hint));
    if (match) return match;
  }

  const notFemale = english.find(
    (v) => !v.name.toLowerCase().includes('female') && !v.name.toLowerCase().includes('zira')
  );
  return notFemale ?? english[0];
}

export function speakEnglishWord(text: string): void {
  if (!('speechSynthesis' in window) || !text.trim()) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.lang = 'en-US';

  const voices = loadVoices();
  const voice = pickGrandpaVoice(voices);
  if (voice) utterance.voice = voice;

  utterance.rate = 0.78;
  utterance.pitch = 0.72;
  utterance.volume = 1;

  window.speechSynthesis.speak(utterance);
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}
