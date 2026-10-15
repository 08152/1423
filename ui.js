export function createClickSound() {
  let context = null;
  function getContext() {
    if (!context) context = new (window.AudioContext || window.webkitAudioContext)();
    if (context.state === 'suspended') context.resume().catch(() => {});
    return context;
  }
  function click(loud = true) {
    try {
      const ctx = getContext(); const now = ctx.currentTime;
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = 'square'; osc.frequency.setValueAtTime(1250, now); osc.frequency.exponentialRampToValueAtTime(310, now + .065);
      gain.gain.setValueAtTime(loud ? .43 : .2, now); gain.gain.exponentialRampToValueAtTime(.001, now + .085);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(now); osc.stop(now + .09);
      const noise = ctx.createBufferSource(); const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .04), ctx.sampleRate); const arr = buffer.getChannelData(0);
      for (let i = 0; i < arr.length; i++) arr[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / arr.length, 2);
      noise.buffer = buffer; const ng = ctx.createGain(); ng.gain.setValueAtTime(loud ? .18 : .07, now); ng.gain.exponentialRampToValueAtTime(.001, now + .04); noise.connect(ng); ng.connect(ctx.destination); noise.start(now); noise.stop(now + .045);
    } catch { /* Audio can be unavailable in restrictive browsers. */ }
  }
  function thump() {
    try { const ctx = getContext(), now = ctx.currentTime; const osc = ctx.createOscillator(), gain = ctx.createGain(); osc.type = 'sine'; osc.frequency.setValueAtTime(105, now); osc.frequency.exponentialRampToValueAtTime(36, now + .28); gain.gain.setValueAtTime(.45, now); gain.gain.exponentialRampToValueAtTime(.001, now + .32); osc.connect(gain); gain.connect(ctx.destination); osc.start(now); osc.stop(now + .33); } catch {}
  }
  return { click, thump };
}

export function showToast(message, duration = 2100) {
  const node = document.getElementById('toast');
  if (!node) return;
  node.textContent = message; node.classList.add('show');
  clearTimeout(node._toastTimer);
  node._toastTimer = setTimeout(() => node.classList.remove('show'), duration);
}

export function setCaption(message, visible = true) {
  const node = document.getElementById('sequence-caption');
  node.textContent = message; node.classList.toggle('hidden', !visible || !message);
}
