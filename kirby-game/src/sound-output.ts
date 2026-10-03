/** Keep the shared bus stereo when mono voices and positional steps come and go. */
export function createSoundOutput(context:BaseAudioContext){
  const master=context.createGain(),headroom=context.createGain(),limiter=context.createDynamicsCompressor();
  // With automatic channel counts, a StereoPanner appearing/disappearing can
  // reinitialise the compressor's look-ahead buffer and interrupt every sound.
  for(const node of [master,headroom,limiter]){
    node.channelCount=2;node.channelCountMode='explicit';node.channelInterpretation='speakers';
  }
  headroom.gain.value=.35;
  limiter.threshold.value=-2;limiter.knee.value=0;limiter.ratio.value=20;
  limiter.attack.value=0;limiter.release.value=.05;
  master.connect(headroom);headroom.connect(limiter);
  return {master,headroom,limiter};
}
