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

  Object.defineProperties(emitter, {
    duration: {
      enumerable: true, configurable: true,
      get: function () {
        return duration
      }
    },
    currentTime: {
      enumerable: true, configurable: true,
      get: function () {
        if(pausedAt) {
            return pausedAt;
        }
        if(startedAt) {
            return audioContext.currentTime - startedAt;
        }
        return 0;
      }
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

  emitter.crossfadeToAudioBuffer = function(audiobuffer){



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
