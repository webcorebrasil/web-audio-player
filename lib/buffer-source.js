var canPlaySrc = require('./can-play-src')
var createAudioContext = require('./audio-context')
var xhrAudio = require('./xhr-audio')
var EventEmitter = require('events').EventEmitter
var rightNow = require('right-now')
var resume = require('./resume-context')

module.exports = createBufferSource
function createBufferSource (src, opt) {
  opt = opt || {}
  var emitter = new EventEmitter()
  var audioContext = opt.context || createAudioContext()

  // a pass-through node so user just needs to
  // connect() once
  var bufferNode, buffer, duration
  var gainNode = audioContext.createGain()
  var analyzerGainNode = audioContext.createGain()
  var playing = false
  var startedAt = 0
  var pausedAt = 0

  emitter.play = function () {
    if (playing) return
    playing = true

    var offset = pausedAt;

    disposeBuffer()
    bufferNode = audioContext.createBufferSource()
    bufferNode.connect(emitter.gainNode)
    bufferNode.connect(emitter.analyzerGainNode)
    emitter.gainNode.connect(audioContext.destination)
    bufferNode.onended = ended
    if (buffer) {
      // Might be null undefined if we are still loading
      bufferNode.buffer = buffer
    }

    bufferNode.start(0, offset)
    startedAt = audioContext.currentTime - offset;
    pausedAt = 0;

  }

  emitter.pause = function () {
    if (!playing) return
    playing = false
    // Don't let the "end" event
    // get triggered on manual pause.
    bufferNode.onended = null
    bufferNode.stop(0)
    var elapsed = audioContext.currentTime - startedAt;
    pausedAt = elapsed;
    startedAt = 0;
  }

  emitter.stop = function () {
    emitter.pause()
    ended()
  }

  emitter.dispose = function () {
    disposeBuffer()
    buffer = null
  }

  emitter.gainNode = gainNode
  emitter.analyzerGainNode = analyzerGainNode
  emitter.context = audioContext

  function getCurrentTime(){

    if(pausedAt) {
      return pausedAt;
    }

    if(startedAt) {
      return audioContext.currentTime - startedAt;
    }

    return 0;

  }

  Object.defineProperties(emitter, {
    duration: {
      enumerable: true, configurable: true,
      get: function () {
        return duration
      }
    },
    currentTime: {
      enumerable: true, configurable: true,
      get: getCurrentTime,
    },
    playing: {
      enumerable: true, configurable: true,
      get: function () {
        return playing
      }
    },
    buffer: {
      enumerable: true, configurable: true,
      get: function () {
        return buffer
      }
    },
    volume: {
      enumerable: true, configurable: true,
      get: function () {
        return gainNode.gain.value
      },
      set: function (n) {
        gainNode.gain.value = n
      }
    }
  })

  // set initial volume
  if (typeof opt.volume === 'number') {
    emitter.volume = opt.volume
  }

  loadBuffer(src)

  // Math.cos(x * 0.5 * Math.PI)
  const rampValuesOut = [1, 0.984807753012208, 0.9396926207859084, 0.8660254037844387, 0.766044443118978, 0.6427876096865394, 0.5000000000000001, 0.3420201433256688, 0.17364817766693041, 0]

  // Math.cos((1.0 - (i / 9)) * 0.5*Math.PI)
  const rampValuesIn = [0, 0.17364817766693041, 0.3420201433256688, 0.4999999999999999, 0.6427876096865394, 0.766044443118978, 0.8660254037844386, 0.9396926207859084, 0.984807753012208, 1]
  
  emitter.crossfadeToAudioBuffer = function(audiobuffer){

    const curretTime = getCurrentTime()

    const crossfadingDuration = 2.0

    let newgainNode = audioContext.createGain()
    newgainNode.gain.value = 0
    let newbufferNode = audioContext.createBufferSource()
    newbufferNode.buffer = audiobuffer
    newbufferNode.connect(newgainNode)

    analyzerGainNode = audioContext.createGain()
    analyzerGainNode.gain.value = 0.2
    emitter.analyzerGainNode = analyzerGainNode

    newgainNode.connect(emitter.analyzerGainNode)
    newgainNode.connect(audioContext.destination)
    newbufferNode.onended = ended

    newbufferNode.start(0, curretTime)
    startedAt = curretTime;
    pausedAt = 0;

    console.log(curretTime, audioContext.destination.numberOfInputs)

    //gainNode.gain.setValueCurveAtTime(rampValuesOut, audioContext.currentTime, crossfadingDuration)
    //newgainNode.gain.setValueCurveAtTime(rampValuesIn, audioContext.currentTime, crossfadingDuration)

    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + crossfadingDuration)
    newgainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + crossfadingDuration)

    emitter.emit('crossfading')

    setTimeout(() => {

      console.log('crossfade middle', gainNode.gain.value, newgainNode.gain.value)

    }, 1000)

    setTimeout(() => {

      console.log('crossfade ended')

      buffer = audiobuffer
      duration = audiobuffer.duration
      bufferNode.disconnect()
      bufferNode = newbufferNode
      gainNode = newgainNode

      emitter.gainNode = gainNode

    }, crossfadingDuration * 1000)

  }

  return emitter

  function loadBuffer(audiobuffer){

    process.nextTick(function(){

      buffer = audiobuffer
      if(bufferNode){
        // if play() was called early
        bufferNode.buffer = buffer
      }
      duration = buffer.duration
      //gainNode.buffer = buffer
      analyzerGainNode.gain.value = 0.2
      emitter.emit('load')

    })

  }

  function ended () {
    emitter.emit('end')
    playing = false
  }

  function disposeBuffer () {
    if (bufferNode) bufferNode.disconnect()
  }
}
