'use strict'

const util = require('util')
const url = require('url')
const http = require('http')
const async = require('async')
const readline = require('readline')
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

require('./polyfills')
const relative = require('./relative')
const cmd = require('./commandline')

function getLastfmRecentTracks(cb) {
  if (relative.exists('enrichedsavelastfmrecenttracks.json')) {
    return cb(null, relative.jsonRead('enrichedsavelastfmrecenttracks.json'))
  } else {
    console.error('no enrichedsavelastfmrecenttracks.json')
    process.exit(1)
  }
}

const mappingRedundantEnrichment = relative.jsonRead('enrichedMapping.json')

const toSearch = '&&&SEARCH&&&'
const searchArtistId = '&&&ARTIST_ID&&&'
const mbUrl = 'http://musicbrainz.org/ws/2/'
const artistSearchUrl = mbUrl + `artist?query=${toSearch}&limit=3&fmt=json`
const albumSearchUrl = mbUrl + `release?query="${toSearch}" AND arid:${searchArtistId}&limit=3&fmt=json`
const trackSearchUrl = mbUrl + `recording?query="${toSearch}" AND arid:${searchArtistId}&limit=3&fmt=json`

function optProxy(baseOpt) {
  return {
    host: "172.16.99.9",
    port: 3129,
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
  req.setHeader('User-Agent', 'EnrichLastFmData')
  req.on('error', (err) => errorCb(err))
  req.end()
}

function searchArtist(artistText, cb) {
  req(artistSearchUrl.replace(toSearch, artistText), 'GET', (err, res) => {
    if (err) {
      return setTimeout(() => cb(err), 10000)
    }
    return cb(null, JSON.parse(res))
  }, true)
}
function searchAlbum(albumText, artistId, cb) {
  req(albumSearchUrl.replace(toSearch, albumText).replace(searchArtistId, artistId), 'GET', (err, res) => {
    if (err) {
      return setTimeout(() => cb(err), 10000)
    }
    return cb(null, JSON.parse(res))
  }, true)
}
function searchTrack(trackText, artistId, cb) {
  req(trackSearchUrl.replace(toSearch, trackText).replace(searchArtistId, artistId), 'GET', (err, res) => {
    if (err) {
      return setTimeout(() => cb(err), 10000)
    }
    return cb(null, JSON.parse(res))
  }, true)
}

function awaitFor(begin, stop, fn, cb) {
  if (begin > stop) return cb()
  fn(begin, (err) => {
    if (err) return cb(err)
    awaitFor(begin + 1, stop, fn, cb)
  })
}

function suggestEnrichment(tracksContent) {
  awaitFor(0, tracksContent.length, (i, cb) => {
    const track = tracksContent[i]
    if (track['@attr'] && track['@attr'].nowplaying) return cb()

    // let year = new Date(parseInt(track.date.uts) * 1000).getFullYear()
    let trackImages = track.image
    delete track.image

    let oneChange = false
    async.waterfall([
      (asyncCb) => {
        if (track.artist && track.artist.mbid === '') {
          if (mappingRedundantEnrichment.artist[`alb ${track.album['#text']} art ${track.artist['#text']}`]) {
            track.artist.mbid = mappingRedundantEnrichment.artist[`alb ${track.album['#text']} art ${track.artist['#text']}`]
            oneChange = true
            return asyncCb()
          }
          if (mappingRedundantEnrichment.notFound.artist[`alb ${track.album['#text']} art ${track.artist['#text']}`] === '') {
            return asyncCb()
          }
          searchArtist(track.artist['#text'], (err, res) => {
            if (err) {
              console.log(err)
              return asyncCb()
            }
            cmd.drawChoices(res, track)
            rl.question('which one is the correct one ?\n', (answer => {
              let int = parseInt(answer)
              if (int === res.artists.length) {
                rl.question('manual entry mbid: ', (mb => {
                  mb = mb.trim()
                  track.artist.id = mb
                  mappingRedundantEnrichment.artist[`alb ${track.album['#text']} art ${track.artist['#text']}`] = mb
                  oneChange = true
                  return asyncCb()
                }))
              } else if (int === res.artists.length + 1) {
                mappingRedundantEnrichment.notFound.artist[`alb ${track.album['#text']} art ${track.artist['#text']}`] = ''
                oneChange = true
                return asyncCb()
              } else if (res.artists[int] && res.artists[int].id) {
                track.artist.mbid = res.artists[int].id
                mappingRedundantEnrichment.artist[`alb ${track.album['#text']} art ${track.artist['#text']}`] = res.artists[int].id
                oneChange = true
                return asyncCb()
              } else {
                return asyncCb()
              }
            }))
          })
        } else {
          asyncCb()
        }
      },
      (asyncCb) => {
        if (track.album && track.album.mbid === '' && track.artist.mbid !== '') {
          if (mappingRedundantEnrichment.album[`alb ${track.album['#text']} art ${track.artist['#text']}`]) {
            track.album.mbid = mappingRedundantEnrichment.album[`alb ${track.album['#text']} art ${track.artist['#text']}`]
            oneChange = true
            return asyncCb()
          }
          if (mappingRedundantEnrichment.notFound.album[`alb ${track.album['#text']} art ${track.artist['#text']}`] === '') {
            return asyncCb()
          }
          searchAlbum(track.album['#text'], track.artist.mbid, (err, res) => {
            if (err) {
              console.log(err)
              return asyncCb()
            }
            cmd.drawChoices(res, track)
            rl.question('which one is the correct one ?\n', (answer => {
              let int = parseInt(answer)
              if (int === res.releases.length) {
                rl.question('manual entry mbid: ', (mb => {
                  mb = mb.trim()
                  track.album.id = mb
                  mappingRedundantEnrichment.album[`alb ${track.album['#text']} art ${track.artist['#text']}`] = mb
                  oneChange = true
                  return asyncCb()
                }))
              } else if (int === res.releases.length + 1) {
                mappingRedundantEnrichment.notFound.album[`alb ${track.album['#text']} art ${track.artist['#text']}`] = ''
                oneChange = true
                return asyncCb()
              } else if (res.releases[int] && res.releases[int].id) {
                track.album.mbid = res.releases[int].id
                mappingRedundantEnrichment.album[`alb ${track.album['#text']} art ${track.artist['#text']}`] = res.releases[int].id
                oneChange = true
                return asyncCb()
              } else {
                return asyncCb()
              }
            }))
          })
        } else {
          asyncCb()
        }
      },
      (asyncCb) => {
        if (track.mbid === '' && track.artist.mbid) {
          if (mappingRedundantEnrichment.track[`t ${track.name} alb ${track.album['#text']} art ${track.artist['#text']}`]) {
            track.mbid = mappingRedundantEnrichment.track[`t ${track.name} alb ${track.album['#text']} art ${track.artist['#text']}`]
            oneChange = true
            return asyncCb()
          }
          if (mappingRedundantEnrichment.notFound.track[`t ${track.name} alb ${track.album['#text']} art ${track.artist['#text']}`] === '') {
            return asyncCb()
          }
          searchTrack(track.name, track.artist.mbid, (err, res) => {
            if (err) {
              console.log(err)
              return asyncCb()
            }
            cmd.drawChoices(res, track)
            rl.question('which one is the correct one ?\n', (answer => {
              let int = parseInt(answer)
              if (int === res.recordings.length) {
                rl.question('manual entry mbid: ', (mb => {
                  mb = mb.trim()
                  track.mbid = mb
                  mappingRedundantEnrichment.track[`t ${track.name} alb ${track.album['#text']} art ${track.artist['#text']}`] = mb
                  oneChange = true
                  return asyncCb()
                }))
              } else if (int === res.recordings.length + 1) {
                mappingRedundantEnrichment.notFound.track[`t ${track.name} alb ${track.album['#text']} art ${track.artist['#text']}`] = ''
                oneChange = true
                return asyncCb()
              } else if (res.recordings[int] && res.recordings[int].id) {
                track.mbid = res.recordings[int].id
                mappingRedundantEnrichment.track[`t ${track.name} alb ${track.album['#text']} art ${track.artist['#text']}`] = res.recordings[int].id
                oneChange = true
                return asyncCb()
              } else {
                return asyncCb()
              }
            }))
          })
        } else {
          asyncCb()
        }
      },
      (asyncCb) => {
        track.image = trackImages
        if (oneChange) {
          relative.jsonSaveBeautiful(mappingRedundantEnrichment, 'enrichedMapping.json')
          relative.jsonSave(tracksContent, 'enrichedsavelastfmrecenttracks.json')
        }
        asyncCb()
      }
    ], cb)
  })

}

getLastfmRecentTracks((_, content) => {
  suggestEnrichment(content)
})
