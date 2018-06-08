'use strict'

const http = require('http')
const path = require('path')
const url = require('url')

const gm = require('gm')

const relative = require('./relative')
const objstruct = require('./objStruct')
require('./polyfills')

const user = '',
  lastfmApiKey = '',
  minPlayCountAlbum = 16,
  method = '&&&METHOD&&&',
  userT = '&&&USER&&&',
  apiKey = '&&&API_KEY&&&',
  noPage = '&&&NO_PAGE&&&'

const lastfmUri = `http://ws.audioscrobbler.com/2.0/?method=user.${method}&user=${userT}&api_key=${apiKey}&page=${noPage}&format=json`
const lastfmTopAlbums = lastfmUri
  .replace(method, 'gettopalbums')
  .replace(userT, user)
  .replace(apiKey, lastfmApiKey)
const lastfmTopArtists = lastfmUri
  .replace(method, 'gettopartits')
  .replace(userT, user)
  .replace(apiKey, lastfmApiKey)
const lastfmRecentTracks = lastfmUri
  .replace(method, 'getrecenttracks')
  .replace(userT, user)
  .replace(apiKey, lastfmApiKey)

function optProxy(baseOpt) {
  return {
    host: "",  // Proxy IP here
    port: 0,   // Proxy port here
    path: baseOpt.completeUrl,
    method: baseOpt.method,
  }
}

function req(uri, method, cb, isBehindProxy) {
  if (isBehindProxy === undefined) isBehindProxy = true
  let errorCbCalled = false
  function errorCb(err) {
    if (!errorCbCalled) {
      errorCbCalled = true
      cb(err)
    }
  }
  let { protocol, hostname, path } = url.parse(uri)
  path = encodeURIComponent(path)
  let opt = {
    protocol,
    hostname,
    path,
    method: method,
    completeUrl: encodeURI(uri)
  }
  if (isBehindProxy) {
    opt = optProxy(opt)
  }
  let req = http.request(opt, res => {
    if (res.statusCode !== 200) {
      console.log(`${uri}: ${res.statusCode}`);
    }
    res.setEncoding('utf8')
    let data = ''
    res.on('data', chunk => {
      data += chunk
    })
    res.on('end', () => {
      if (res.statusCode !== 200)
        return cb(data, null)
      return cb(null, data)
    })
    res.on('error', (err) => errorCb(err))
  })
  req.on('error', (err) => errorCb(err))
  req.end()
}

function awaitFor(begin, stop, fn, treatResFn, cb) {
  if (begin > stop) return cb()
  fn(begin, (err, res) => {
    if (err) return cb(err)
    treatResFn(JSON.parse(res))
    awaitFor(begin + 1, stop, fn, treatResFn, cb)
  })
}

function getPageFn(reqUrl, total) {
  return function(nb, cb) {
    console.log(`request ${nb}/${total === undefined ? 'unknown' : total.toString()}`)
    req(reqUrl.replace('&&&NO_PAGE&&&', nb), 'GET', (err, page) => {
      if (err) return cb(err)
      return cb(null, page)
    })
  }
}

function commonFetchLastFm(uri, getTotalPagesFn, getContentFn, cb) {
  getPageFn(uri)(1, (err, res) => {
    if (err) return cb(err)
    const page = JSON.parse(res)
    const totalPages = getTotalPagesFn(page)
    let pages = getContentFn(page)
    awaitFor(2, totalPages, getPageFn(uri, totalPages), page => pages = pages.concat(getContentFn(page)), (err) => {
      if (err) return cb(err)
      return cb(null, pages)
    })
  })
}

function getLastfmAlbums(cb) {
  if (relative.exists('savelastfmalbums.json')) {
    return cb(null, relative.jsonRead('savelastfmalbums.json'))
  }
  console.log('fetching lastfm albums')
  commonFetchLastFm(lastfmTopAlbums,
    page => page.topalbums['@attr'].totalPages,
    page => page.topalbums.album,
    (err, res) => {
      if (err) return cb(err)
      res = res.filter((el) => el.playcount >= minPlayCountAlbum)
      relative.jsonSave(res, 'savelastfmalbums.json')
      cb(null, res)
    })
}

function getLastfmArtist(cb) {
  if (relative.exists('savelastfmartists.json')) {
    return cb(null, relative.jsonRead('savelastfmartists.json'))
  }
  console.log('fetching lastfm artists')
  commonFetchLastFm(lastfmTopArtists, page => page.topartists['@attr'].totalPages, page => page.topartists.artist, (err, res) => {
    if (err) return cb(err)
    relative.jsonSave(res, 'savelastfmartists.json')
    return cb(null, res)
  })
}

function getLastfmRecentTracks(cb) {
  if (relative.exists('savelastfmrecenttracks.json')) {
    return cb(null, relative.jsonRead('savelastfmrecenttracks.json'))
  }
  console.log('fetching lastfm recent tracks')
  commonFetchLastFm(lastfmRecentTracks, page => page.recenttracks['@attr'].totalPages, page => page.recenttracks.track, (err, res) => {
    if (err) return cb(err)
    relative.jsonSave(res, 'savelastfmrecenttracks.json')
    return cb(null, res)
  })
}

function getContentFullStruct(content) {
  let struct = {}
  content.forEach(track => {
    let s = objstruct.getStructure(track)
    struct = objstruct.mergeObjs(struct, s)
  })
  return struct
}

function tryFindingListeningHabits(tracksContent) {
  const threeDays = 3 * 24 * 60 * 60
  const artists = {}
  tracksContent.forEach(track => {
    if (track['@attr'] && track['@attr'].nowplaying === 'true')
      return

    const artistName = track.artist['#text']
    const uts = parseInt(track.date.uts)

    // init artist listening habits
    if (artists[artistName] === undefined) {
      artists[artistName] = [ { start: uts, end: uts } ]
    }
    const threeDaysBeforeLastEndListening = artists[artistName].last().end - threeDays
    // last time listened too far away, create a new habits for this artist
    if (uts < threeDaysBeforeLastEndListening) {
      artists[artistName].push({ start: uts, end: uts })
    }
    // increase last time start, since continuing listening to this artist
    else {
      artists[artistName].last().end = uts
    }
  })
  return artists
}

function getAllArtistsFromTracks(tracksContent) {
  const artists = {}
  tracksContent.forEach(track => {
    if (track['@attr'] && track['@attr'].nowplaying === 'true')
      return

    const artistName = track.artist['#text']
    if (artists[artistName] === undefined)
      artists[artistName] = null
  })
  return Object.keys(artists)
}

function remapArtistsSongFromAlbum(trackContent) {
  const albums = {}
  trackContent.forEach(track => {
    if (track['@attr'] && track['@attr'].nowplaying === 'true')
      return

    const artistName = track.artist['#text']
    const albumName = track.album['#text']

    if (albums[albumName] === undefined)
      albums[albumName] = {}

    if (albums[albumName][artistName] === undefined)
      albums[albumName][artistName] = []

    albums[albumName][artistName].push(track)
  })
  delete albums['']

  let alb = Object.keys(albums)
  for (let i = 0; i < alb.length; i++) {
    if ('late night tales'.isContainedIn(alb[i].toLowerCase())) {
      delete albums[alb[i]]
    }
  }

  alb = Object.keys(albums)
  alb.forEach(albName => {
    const artitsNames = Object.keys(albums[albName])
    if (artitsNames.length > 1) {
      console.log(`${albName}: ${artitsNames}`)
      // for each artists in albumName
      for (let i = 0; i < artitsNames.length; i++) {
        let toCompareArtist = artitsNames[i].toLowerCase()
        for (let j = 0; j < artitsNames.length; j++) {
          if (j === i) continue
          let maybeSame = artitsNames[j].toLowerCase()

          if (toCompareArtist.isContainedIn(maybeSame)) {
            for (let a = 0; a < albums[albName][artitsNames[j]].length; a++) {
              albums[albName][artitsNames[j]][a].artist['#text'] = artitsNames[i]
            }
            albums[albName][artitsNames[i]].push(...albums[albName][artitsNames[j]])
            delete albums[albName][artitsNames[j]]
          }
        }
      }

    }
  })
}

/**
 * @typedef {Object} Track
 * @property {String} name
 * @property {Object} artist
 * @property {String} artist.#text
 * @property {String} artist.mbid
 * @property {Object} album
 * @property {String} album.#text
 * @property {String} album.mbid
 */

class ServeListeningHabits {

  /**
   * @param {Object<String, Array<Object>>} artistsHabits
   */
  constructor(artistsHabits) {
    this.content = JSON.stringify(artistsHabits)
    this.server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, X-Access-Token')
      res.write(this.content)
      res.end()
    })
    this.server.listen(5000)
  }

}

/**
 * @param {Array.<HabitsPart>} habits
 */
function containsWrongDate(habits) {

  for (let i = 0; i < habits.length; i++) {
    if (habits[i].start < 946080000 || habits[i].end < 946080000) {
      return true
    }
  }

  return false

}

/**
 * @param {Object.<String, Array.<HabitsPart>>} habits
 * @return {Object.<String, Array.<HabitsPart>>}
 */
function filterOutOneTimeArtists(habits) {

  const names = Object.keys(habits)
  for (let i = 0; i < names.length; i++) {
    /*if (habits[names[i]].length === 1) {
      delete habits[names[i]]
      continue
    }*/
    if (containsWrongDate(habits[names[i]])) {
      delete habits[names[i]]
    }
  }

  return habits

}

function genImg(habits) {
  filterOutOneTimeArtists(habits)
  const names = Object.keys(habits)
  const lenHabits = names.length
  const width = 1460 * 3 + 200
  const height = lenHabits * 20 + 40
  const wip = gm(width, height, '#fff')

  for (let i = 0; i < names.length; i++) {
    const art = names[i]
    wip.drawText(5, (i * 20) + 25, art)

    for (let j = 0; j < habits[art].length; j++) {
      const h = habits[art][j]
      const xUL = ((h.start - 1387584000) / 86400) * 2// minus 44 years, pin start to 2014
      const yUL = (i * 20) + 10
      const xLR = ((h.end - 1387584000) / 86400) * 2
      const yLR = (i * 20) + 30
      wip.drawRectangle(xUL, yUL, xLR, yLR)
    }

    wip.drawLine(2, (i * 20) + 30, width - 2, (i *20) + 30)

  }

  wip.write(path.join(__dirname, 'test.jpg'), (err) => {
    if (err)
      console.error(err)
    else
      console.log('written img')
  })
}

getLastfmRecentTracks((err, content) => {
  console.log(getContentFullStruct(content))
  remapArtistsSongFromAlbum(content)
  const habits = tryFindingListeningHabits(content)
  new ServeListeningHabits(habits)
  genImg(habits)
})

