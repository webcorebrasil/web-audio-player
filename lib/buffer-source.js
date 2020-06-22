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
  var bufferNode, trackindex, duration
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
    if (window.loadedTrack[trackindex]) {
      // Might be null undefined if we are still loading
      bufferNode.buffer = window.loadedTrack[trackindex]
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
      set: function(n){
        emitter.pause()
        pausedAt = n
        emitter.play()
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
        return window.loadedTrack[trackindex]
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

  const loadBuffer = function(index){

    trackindex = index

    process.nextTick(function(){

      if(bufferNode){
        bufferNode.onended = null
        bufferNode.stop(0)
        bufferNode.disconnect()
      }

      bufferNode = null

      try{

        if(gainNode && gainNode.disconnect)
          gainNode.disconnect()

      }catch(e){}

      gainNode = null

      try{

        if(analyzerGainNode && analyzerGainNode.disconnect)
          analyzerGainNode.disconnect()

      }catch(e){}

      analyzerGainNode = null

      gainNode = audioContext.createGain()
      gainNode.gain.value = 0
      
      bufferNode = audioContext.createBufferSource()
      bufferNode.buffer = window.loadedTrack[index]
      bufferNode.connect(gainNode)

      analyzerGainNode = audioContext.createGain()
      analyzerGainNode.gain.value = 0.2
      emitter.analyzerGainNode = analyzerGainNode

      gainNode.connect(emitter.analyzerGainNode)
      gainNode.connect(audioContext.destination)
      bufferNode.onended = ended

      pausedAt = 0;

      duration = window.loadedTrack[index].duration

      emitter.gainNode = gainNode
      emitter.emit('load')

    })

  }

  emitter.loadBuffer = loadBuffer

  loadBuffer(src)

  // Math.cos(x * 0.5 * Math.PI)
  const rampValuesOut = [1,0.9998741276738751,0.9994965423831851,0.998867339183008,0.9979866764718844,0.9968547759519424,0.9954719225730846,0.9938384644612541,0.9919548128307953,0.9898214418809327,0.9874388886763943,0.984807753012208,0.9819286972627067,0.9788024462147787,0.975429786885407,0.9718115683235417,0.9679487013963562,0.963842158559942,0.9594929736144974,0.9549022414440739,0.9500711177409454,0.9450008187146685,0.9396926207859084,0.9341478602651068,0.9283679330160726,0.9223542941045814,0.9161084574320696,0.9096319953545184,0.9029265382866213,0.8959937742913359,0.8888354486549235,0.8814533634475821,0.8738493770697849,0.8660254037844387,0.8579834132349771,0.8497254299495144,0.8412535328311812,0.8325698546347713,0.8236765814298328,0.8145759520503357,0.8052702575310586,0.7957618405308321,0.7860530947427875,0.7761464642917568,0.766044443118978,0.7557495743542584,0.7452644496757548,0.7345917086575333,0.7237340381050702,0.7126941713788628,0.7014748877063213,0.690079011482112,0.6785094115571322,0.6667690005162916,0.6548607339452851,0.6427876096865394,0.6305526670845225,0.6181589862206052,0.6056096871376667,0.5929079290546406,0.5800569095711982,0.5670598638627707,0.5539200638661103,0.5406408174555977,0.5272254676105024,0.5136773915734064,0.5000000000000001,0.48619673610046865,0.4722710747726827,0.45822652172741046,0.44406661260577424,0.42979491208917175,0.41541501300188644,0.4009305354066138,0.38634512569312857,0.3716624556603275,0.3568862215918719,0.3420201433256688,0.3270679633174218,0.3120334456984871,0.2969203753282749,0.2817325568414296,0.266473813690035,0.2511479871810792,0.23575893550942728,0.22031053278654075,0.20480666806519066,0.18925124436041021,0.17364817766693041,0.15800139597335003,0.14231483827328534,0.1265924535737493,0.1108381999010111,0.09505604330418259,0.07924995685678844,0.06342391965656456,0.0475819158237424,0.031727933498067816,0.01586596383480793,0]

  // Math.cos((1.0 - x) * 0.5*Math.PI)
  const rampValuesIn = [0,0.01586596383480793,0.031727933498067816,0.0475819158237424,0.06342391965656456,0.07924995685678844,0.09505604330418259,0.1108381999010111,0.1265924535737493,0.14231483827328534,0.15800139597335003,0.17364817766693041,0.18925124436041021,0.20480666806519066,0.22031053278654075,0.23575893550942728,0.2511479871810792,0.266473813690035,0.2817325568414298,0.2969203753282749,0.3120334456984871,0.3270679633174218,0.3420201433256688,0.3568862215918719,0.3716624556603275,0.3863451256931288,0.4009305354066138,0.41541501300188644,0.42979491208917175,0.44406661260577424,0.45822652172741046,0.4722710747726827,0.4861967361004688,0.4999999999999999,0.5136773915734064,0.5272254676105026,0.5406408174555977,0.5539200638661103,0.5670598638627707,0.5800569095711982,0.5929079290546404,0.6056096871376667,0.6181589862206053,0.6305526670845225,0.6427876096865394,0.6548607339452851,0.6667690005162916,0.6785094115571322,0.690079011482112,0.7014748877063214,0.7126941713788629,0.7237340381050702,0.7345917086575333,0.7452644496757548,0.7557495743542583,0.766044443118978,0.7761464642917568,0.7860530947427875,0.7957618405308321,0.8052702575310585,0.8145759520503357,0.8236765814298328,0.8325698546347714,0.8412535328311812,0.8497254299495144,0.8579834132349771,0.8660254037844386,0.873849377069785,0.8814533634475821,0.8888354486549235,0.8959937742913359,0.9029265382866212,0.9096319953545184,0.9161084574320696,0.9223542941045815,0.9283679330160726,0.9341478602651067,0.9396926207859084,0.9450008187146685,0.9500711177409454,0.9549022414440739,0.9594929736144975,0.963842158559942,0.9679487013963562,0.9718115683235417,0.975429786885407,0.9788024462147787,0.9819286972627067,0.984807753012208,0.9874388886763943,0.9898214418809327,0.9919548128307953,0.9938384644612541,0.9954719225730846,0.9968547759519424,0.9979866764718844,0.998867339183008,0.9994965423831851,0.9998741276738751,1]
  
  emitter.crossfadeToAudioBuffer = function(index, startatbeginning = true, duration = 1.0, linear = true){

    const curretTime = getCurrentTime()

    const crossfadingDuration = duration

    let newgainNode = audioContext.createGain()
    newgainNode.gain.value = 0
    let newbufferNode = audioContext.createBufferSource()
    newbufferNode.buffer = window.loadedTrack[index]
    newbufferNode.connect(newgainNode)

    analyzerGainNode = audioContext.createGain()
    analyzerGainNode.gain.value = 0.2
    emitter.analyzerGainNode = analyzerGainNode

    newgainNode.connect(emitter.analyzerGainNode)
    newgainNode.connect(audioContext.destination)
    newbufferNode.onended = ended

    console.log(curretTime, startedAt, pausedAt, audioContext.currentTime, audioContext.destination.numberOfInputs)

    if(startatbeginning){

      newbufferNode.start(0)
      startedAt = audioContext.currentTime;
      pausedAt = 0;

    }else{

      newbufferNode.start(0, curretTime)

    }

    if(linear){

      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + crossfadingDuration)
      newgainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + crossfadingDuration)

    }else{

      gainNode.gain.setValueCurveAtTime(rampValuesOut, audioContext.currentTime, crossfadingDuration)
      newgainNode.gain.setValueCurveAtTime(rampValuesIn, audioContext.currentTime, crossfadingDuration)

    }

    emitter.emit('crossfading')

    setTimeout(() => {

      console.log('crossfade ended', index)

      duration = window.loadedTrack[index].duration
      bufferNode.onended = null
      bufferNode.stop(0)
      bufferNode.disconnect()
      bufferNode = null
      bufferNode = newbufferNode
      gainNode = newgainNode

      emitter.gainNode = gainNode

    }, crossfadingDuration * 1000)

  }

  return emitter

  function ended () {
    emitter.emit('end')
    playing = false
  }

  function disposeBuffer () {
    if (bufferNode) bufferNode.disconnect()
  }
}
