// Copyright Votizen Inc.
var http          = require('http')
  , fs            = require('fs')
  , child_process = require('child_process')
  , path          = require('path')
  , querystring   = require('querystring')

// Config is loaded from config.json file
exports.config = null

var server = http.createServer(function (request, response) {
  console.log('Got request', request.url)
  var body  = ''
    , paths = []
    , json

  Object.keys(exports.config).forEach(function (key) {
    paths.push('/' + key)
  })

  if (-1 === paths.indexOf(request.url)) {
    response.writeHead
      ( 404
      , { 'Server': 'node'
        }
      )
    return response.end('Not found')
  }

  request.setEncoding('utf8')
  request.on('data', function (data) {
    body += data
  })
  request.on('end', function () {
    response.writeHead
      ( 200
      , { 'Server': 'node'
        }
      )
    response.end()

    try {
      body = querystring.parse(body).payload
      json = JSON.parse(body.trim())
    } catch (error) {
      return console.error(error.stack)
    }

    exports.onGithubHook(json, request.url.slice(1))
  })
})

server.listen(8080)

exports.onGithubHook = function (hook, url) {
  var id, child, ref, config, branch, log

  config = exports.config[url]

  if (!config) {
    return console.error('Config for "' + path + '" not found.')
  }

  if (config.branch && hook.ref !== 'refs/heads/' + config.branch) {
    return console.error('Branch did not match. Ignoring.')
  }

  child = child_process.exec(
      config.command
    + ' "' + hook.after + '"'
    + ' "' + hook.ref + '"'
    + ' "' + hook.repository.owner.name + '"'
    + ' "' + hook.repository.name + '"'
  )

  if (config.logdir) {
    log = fs.createWriteStream(
      path.join(config.logdir, new Date().toISOString() + '-' + hook.after.slice(0, 7)) + '.log'
    )

    child.stdout.pipe(log)
    child.stderr.pipe(log, { end: false })
  }

  console.log('Running "' + config.command + '" for "' + url + '"')
}

// Load the config.
fs.readFile('config.json', 'utf8', function (error, data) {
  if (error) {
    throw error
  }

  exports.config = JSON.parse(data.trim())
})
