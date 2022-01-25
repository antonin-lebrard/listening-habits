'use strict'

const http = require('http')
const path = require('path')
const url = require('url')
const fs = require('fs')

const gm = require('gm')

const cmd = require('./commandline')
const relative = require('./relative')
const objstruct = require('./objStruct')
require('./polyfills')

const user = '',
  lastfmApiKey = '',
  minPlayCountAlbum = 16,
  method = '&&&METHOD&&&',
  userT = '&&&USER&&&',
  apiKey = '&&&API_KEY&&&',
  noPage = '&&&NO_PAGE&&&',
  artistToSearch = '&&&ARTIST&&&'

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

const lastfmSimpleMethodUri = `http://ws.audioscrobbler.com/2.0/?method=${method}&artist=${artistToSearch}&api_key=${apiKey}&format=json`
const lastfmArtistsTopTags = lastfmSimpleMethodUri
  .replace(method, 'artist.gettoptags')
  .replace(apiKey, lastfmApiKey)
const lastfmTrackInfo = lastfmSimpleMethodUri
  .replace(method, 'track.getInfo')
  .replace(apiKey, lastfmApiKey)

function optProxy(baseOpt) {
  return {
    host: "",
    port: 1,
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
      if (err) {
        return setTimeout(() => {
          req(reqUrl.replace('&&&NO_PAGE&&&', nb), 'GET', (err, page) => {
            if (err) return cb(err)
            return cb(null, page)
          })
        }, 10000)
      }
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

function testFilename(name) {
  try {
    const fd = fs.openSync(`artistsTopTagsSave/${name}.json`)
    fs.closeSync(fd)
    return true
  } catch (e) {
    return false
  }
}

function forceUtf16(name) {
  if (testFilename(name)) return name
  for (let i = 0; i < name.length; i++) {
    if (name.charCodeAt(i) > 8192 || name[i] === '/') {
      name = name.substring(0, i) + "_" + name.substring(i + 1)
    }
  }
  return name
}

function getLastfmArtistsTopTags(artist, cb) {
  if (relative.exists(`artistsTopTagsSave/${forceUtf16(artist)}.json`)) {
    return cb(null, relative.jsonRead(`artistsTopTagsSave/${forceUtf16(artist)}.json`))
  }
  console.log(`fetching lastfm ${artist} top tags`)
  req(lastfmArtistsTopTags.replace(artistToSearch, artist), 'GET', (err, res) => {
    if (err) return cb(err)
    relative.jsonSave(res, `artistsTopTagsSave/${forceUtf16(artist)}.json`)
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
  const oneMonth = 30 * 24 * 60 * 60
  const artists = {}
  tracksContent.forEach((track) => {
    if (track['@attr'] && track['@attr'].nowplaying === 'true')
      return

    const artistName = track.artist['#text']
    const uts = parseInt(track.date.uts)

    // init artist listening habits
    if (artists[artistName] === undefined) {
      artists[artistName] = [ { start: uts, end: uts } ]
    }

    else {
      let extendedOneTimespan = false,
        curStart,
        curEnd
      for (let i = 0; i < artists[artistName].length; i++) {
        curStart = artists[artistName][i].start
        curEnd = artists[artistName][i].end
        if (uts >= curStart - oneMonth && uts <= curStart) {
          artists[artistName][i].start = uts
          extendedOneTimespan = true
        } else if (uts <= curEnd + oneMonth && uts >= curEnd) {
          artists[artistName][i].end = uts
          extendedOneTimespan = true
        }
      }
      if (!extendedOneTimespan) {
        artists[artistName].push({start: uts, end: uts})
      }
    }
  })
  return artists
}

function topByArbitraryMonths(tracksContent) {
  const oneMonth = 30 * 24 * 60 * 60
  const months = {}
  tracksContent.forEach((track) => {
    if (track['@attr'] && track['@attr'].nowplaying === 'true')
      return

    const artistName = track.artist['#text']
    const uts = parseInt(track.date.uts)
    const month = Math.floor(uts / oneMonth)

    if (months[month] === undefined)
      months[month] = {}
    if (months[month][artistName] === undefined)
      months[month][artistName] = 0
    months[month][artistName] += 1
  })

  const topByMonths = {}
  Object.keys(months).forEach(m => {
    topByMonths[m] = Object.keys(months[m]).sort((a, b) => {
      return months[m][b] - months[m][a]
    }).map(k => { return { artist: k, tracksListened: months[m][k] } })
  })

  return topByMonths
}

function filterOutNotInterestingArtistsInTopByMonths(top) {
  const newTop = {}
  Object.keys(top).forEach(m => {
    newTop[m] = top[m].filter(el => el.tracksListened > 5)
  })
  return newTop
}

function extractTags(lastfmTags) {
  if (!lastfmTags) return []
  if (lastfmTags.error) return []
  return lastfmTags
    .toptags
    .tag
    .map((el) => {
      return {
        name: el.name,
        count: el.count
      }
    })
}

function fetchTags(habits, cb) {
  const artists = Object.keys(habits)
  let idx
  awaitFor(
    0,
    artists.length - 1,
    (i, cb) => {
      idx = i
      getLastfmArtistsTopTags(artists[i], cb)
    },
    res => habits[artists[idx]].tags = extractTags(res),
    (err) => {
      if (err) return cb(err)
      cb()
    }
  )
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

  /**
   * Fusion albums tracks into one album from one artist
   * (eg: Kendrick Lamar's Black Panther album, with so many feats, which split
   * the album into small bits with artist fields containing Kendrick + all feats)
   */
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
            albums[albName][artitsNames[j]] = []
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
    if (habits[names[i]].length === 1) {
      delete habits[names[i]]
      continue
    }
    if (containsWrongDate(habits[names[i]])) {
      delete habits[names[i]]
    }
  }

  return habits

}

function genImg(habits) {
  filterOutOneTimeArtists(habits)

  let minTime = Infinity,
    maxTime = -Infinity
  const names = Object.keys(habits)
  for (let i = 0; i < names.length; i++) {
    for (let j = 0; j < habits[names[i]].length; j++) {
      if (habits[names[i]][j].start < minTime)
        minTime = habits[names[i]][j].start
      if (habits[names[i]][j].end > maxTime)
        maxTime = habits[names[i]][j].end
    }
  }

  const lenHabits = names.length
  const width = 1460 * 3 + 200
  const height = lenHabits * 20 + 40
  const wip = gm(width, height, '#fff')

  for (let i = 0; i < names.length; i++) {
    const art = names[i]
    wip.drawText(5, (i * 20) + 25, art)

    for (let j = 0; j < habits[art].length; j++) {
      const h = habits[art][j]
      const xUL = 500 + ((h.start - minTime) / 86400) * 2// minus 44 years, pin start to 2014
      const yUL = (i * 20) + 10
      const xLR = 500 + ((h.end - minTime) / 86400) * 2
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

function reListeningArtistStat(habits) {
  const totalH = Object.keys(habits).map(art => {
    return {artist: art, len: habits[art].length}
  })
  totalH.sort((a, b) => b.len - a.len)
  totalH.forEach(el => console.log(`${el.artist}: ${el.len}`))
}

function ratioRelistening(habits) {
  const relistenRate = Object.keys(habits).map(art => {
    return {artist: art, len: habits[art].length}
  })

  const mean = relistenRate.mean(el => el.len)
  const median = relistenRate.median(el => el.len)
  console.log(mean, median)
  console.log(relistenRate.filter(el => el.len > 1).length)
  console.log(relistenRate.filter(el => el.len === 1).length)
}

function seasonStat(habits) {
  const reh = Object.keys(habits).map(art => {
    return {
      artist: art,
      summerTimes: habits[art].reduce((acc, el) => {
        const startMonth = new Date(el.start * 1000).getUTCMonth()
        if (startMonth < 8 && startMonth > 5) {
          return acc + ((el.end - el.start) / (60 * 60 * 24))
        }
        return acc
      }, 0),
      winterTimes: habits[art].reduce((acc, el) => {
        const startMonth = new Date(el.start * 1000).getUTCMonth()
        if (startMonth < 2 || startMonth > 9) {
          return acc + ((el.end - el.start) / (60 * 60 * 24))
        }
        return acc
      }, 0),
      autumnTimes: habits[art].reduce((acc, el) => {
        const startMonth = new Date(el.start * 1000).getUTCMonth()
        if (startMonth < 11 && startMonth > 7) {
          return acc + ((el.end - el.start) / (60 * 60 * 24))
        }
        return acc
      }, 0),
      springTimes: habits[art].reduce((acc, el) => {
        const startMonth = new Date(el.start * 1000).getUTCMonth()
        if (startMonth < 5 && startMonth > 1) {
          return acc + ((el.end - el.start) / (60 * 60 * 24))
        }
        return acc
      }, 0),
      allTimes: false
    }
  })
  reh.forEach((recurrence) => {
    recurrence.allTimes =
      [
        recurrence.summerTimes,
        recurrence.winterTimes,
        recurrence.autumnTimes,
        recurrence.springTimes
      ].filter((seasonValue) => seasonValue > 2)
        .length === 4
  })

  console.log('------- SUMMER TIME ---------')
  reh.sort((a, b) => b.summerTimes - a.summerTimes)
  reh.forEach(el => {
    if (el.summerTimes > 3 && !el.allTimes) console.log(`${el.artist}: ${el.summerTimes}`)
  })
  console.log('------- WINTER TIME ---------')
  reh.sort((a, b) => b.winterTimes - a.winterTimes)
  reh.forEach(el => {
    if (el.winterTimes > 3 && !el.allTimes) console.log(`${el.artist}: ${el.winterTimes}`)
  })
  console.log('------- AUTUMN TIME ---------')
  reh.sort((a, b) => b.autumnTimes - a.autumnTimes)
  reh.forEach(el => {
    if (el.autumnTimes > 3 && !el.allTimes) console.log(`${el.artist}: ${el.autumnTimes}`)
  })
  console.log('------- SPRING TIME ---------')
  reh.sort((a, b) => b.springTimes - a.springTimes)
  reh.forEach(el => {
    if (el.springTimes > 3 && !el.allTimes) console.log(`${el.artist}: ${el.springTimes}`)
  })
  console.log('------- ALL TIME ---------')
  reh.sort((a, b) => b.springTimes - a.springTimes)
  reh.forEach(el => {
    if (el.allTimes) console.log(`${el.artist}`)
  })
}

function evolutionTopArtistsByPeriod(tracksContent, lenPeriod) {
  if (!lenPeriod)
    lenPeriod = (30 * 24 * 60 * 60)
  const periods = {}
  tracksContent.forEach((track) => {
    if (track['@attr'] && track['@attr'].nowplaying === 'true')
      return

    const artistName = track.artist['#text']
    const uts = parseInt(track.date.uts)
    const period = Math.floor(uts / lenPeriod)

    if (periods[period] === undefined)
      periods[period] = {}
    if (periods[period][artistName] === undefined)
      periods[period][artistName] = 0
    periods[period][artistName] += 1
  })

  let lastPeriod = undefined
  Object.keys(periods).sort((a, b) => a - b).forEach(p => {
    if (lastPeriod !== undefined) {

      Object.keys(periods[lastPeriod]).forEach(artist => {
        if (periods[p][artist])
          periods[p][artist] += periods[lastPeriod][artist]
        else
          periods[p][artist] = periods[lastPeriod][artist]
      })

    }
    lastPeriod = p
  })

  const topByPeriods = {}
  Object.keys(periods).forEach(p => {
    topByPeriods[p] = Object.keys(periods[p]).sort((a, b) => {
      return periods[p][b] - periods[p][a]
    }).map(k => { return { artist: k, tracksListened: periods[p][k] } })
      .sort((a, b) => b.tracksListened - a.tracksListened)
  })

  return topByPeriods
}


function percentageOfTracksWithMbid(tracksContent) {

  function printStats(nbMbid, artistMbid, albumMbid, trackMbid, total) {
    if (typeof nbMbid === 'object') {
      artistMbid = nbMbid.artistMbid
      albumMbid = nbMbid.albumMbid
      trackMbid = nbMbid.trackMbid
      total = nbMbid.total
      nbMbid = nbMbid.nbMbid
    }
    console.log('mbid:', nbMbid, '/', total, ',', (nbMbid / total * 100).toString().rs(12), '%')
    console.log('artist mbid:', artistMbid, '/', total, ',', (artistMbid / total * 100).toString().rs(12), '%')
    console.log('album mbid:', albumMbid, '/', total, ',', (albumMbid / total * 100).toString().rs(12), '%')
    console.log('track mbid:', trackMbid, '/', total, ',', (trackMbid / total * 100).toString().rs(12), '%')
  }

  const byYear = {}
  const albumMbidsToResponse = {}

  let nbMbid = 0, artistMbid = 0, albumMbid = 0, trackMbid = 0
  tracksContent.forEach(track => {
    if (track['@attr'] && track['@attr'].nowplaying) return

    let year = new Date(parseInt(track.date.uts) * 1000).getFullYear()

    let oneMbid = false
    if (track.artist && track.artist.mbid !== '') {
      oneMbid = true
      artistMbid++
      if (!byYear[year]) {
        byYear[year] = {}
      }
      byYear[year].artistMbid = byYear[year].artistMbid ? byYear[year].artistMbid + 1 : 1
    }
    if (track.album && track.album.mbid !== '') {
      oneMbid = true
      albumMbid++
      if (!byYear[year]) {
        byYear[year] = {}
      }
      byYear[year].albumMbid = byYear[year].albumMbid ? byYear[year].albumMbid + 1 : 1
      albumMbidsToResponse[albumMbid] = null
    }
    if (track.mbid !== '') {
      oneMbid = true
      trackMbid++
      if (!byYear[year]) {
        byYear[year] = {}
      }
      byYear[year].trackMbid = byYear[year].trackMbid ? byYear[year].trackMbid + 1 : 1
    }
    if (oneMbid) {
      nbMbid++
      if (!byYear[year]) {
        byYear[year] = {}
      }
      byYear[year].nbMbid = byYear[year].nbMbid ? byYear[year].nbMbid + 1 : 1
    }
    if (!byYear[year]) {
      byYear[year] = {}
    }
    byYear[year].total = byYear[year].total ? byYear[year].total + 1 : 1

  })
  printStats(nbMbid, artistMbid, albumMbid, trackMbid, tracksContent.length)
  Object.keys(byYear).forEach(year => {
    console.log(year)
    printStats(byYear[year])
  })

  Object.keys(albumMbidsToResponse).forEach(aMbid => {

  })

}

getLastfmRecentTracks((err, content) => {
  console.log(getContentFullStruct(content))
  percentageOfTracksWithMbid(content)

  // remapArtistsSongFromAlbum(content)

  //let topsByMonths = topByArbitraryMonths(content)
  //topsByMonths = filterOutNotInterestingArtistsInTopByMonths(topsByMonths)
  //cmd.printTopByMonth(topsByMonths)

  // let topEvolution = evolutionTopArtistsByPeriod(content)
  // cmd.printEvolutionTopByMonth(topEvolution)

  //reListeningArtistStat(habits)
  //seasonStat(habits)
  //new ServeListeningHabits(habits)
  //genImg(habits)
  //ratioRelistening(habits)
  console.log('finished')
})

