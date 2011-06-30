var test        = require('microtest').module(__dirname + '/server.js')
  , assert      = require('assert')
  , fs          = require('fs')
  , path        = require('path')
  , querystring = require('querystring')

test.requires('http')
test.requires('fs')
test.requires('child_process')
test.requires('path')
test.requires('querystring')

var JSON_STRING      = fs.readFileSync('fixture-hook.json', 'utf8')
  , REQ              = querystring.stringify({ payload: JSON_STRING })
  , REQ_ONE          = REQ.slice(0, 50)
  , REQ_TWO          = REQ.slice(50)
  , SERVER           = test.object('server')
  , CONFIG           = fs.readFileSync('config.test.json', 'utf8')
  , CHILD            = test.object('child')
  , createServerCall = test.expect(test.required.http, 'createServer')
    .andReturn(SERVER)
  , listenCall       = test.expect(SERVER, 'listen')
  , readFileCall     = test.expect(test.required.fs, 'readFile')

var EXPORTS = test.compile()

test.describe('load config', function () {
  var args = readFileCall.calls[0].args

  assert.equal(3, args.length)
  assert.equal('config.json', args[0])
  assert.equal('utf8', args[1])
  assert.equal('function', typeof args[2])

  args[2](null, CONFIG)

  assert.equal('object', typeof EXPORTS.config)
  assert.equal('bash scripts/deploy.sh', EXPORTS.config['secretpath'].command)
})

test.describe('http#createServer', function () {
  var args = createServerCall.calls[0].args

  assert.equal(1, args.length)
  assert.equal('function', typeof args[0])
})

test.describe('server#request', function () {
  var cb       = createServerCall.calls[0].args[0]
    , REQUEST  = test.object('request')
    , RESPONSE = test.object('response')
    , dataCall, endCall, dataArgs, endArgs
    , onGithubHookCall, args
    , writeHeadCall, parseCall

  test.expect(REQUEST, 'setEncoding', 1, ['utf8'])

  dataCall = test.expect(REQUEST, 'on', 1)
  endCall  = test.expect(REQUEST, 'on', 1)

  writeHeadCall = test.expect(RESPONSE, 'writeHead')
  test.expect(RESPONSE, 'end', [])

  REQUEST.url = '/' + Object.keys(EXPORTS.config)[0]

  cb(REQUEST, RESPONSE)

  dataArgs = dataCall.calls[0].args
  endArgs  = endCall.calls[0].args

  assert.equal(2, dataArgs.length)
  assert.equal('function', typeof dataArgs[1])
  assert.equal(2, endArgs.length)
  assert.equal('function', typeof endArgs[1])

  test.expect(
    test.required.querystring
  , 'parse'
  , 1
  , [REQ])
    .andReturn({ payload: JSON_STRING })

  onGithubHookCall = test.expect(EXPORTS, 'onGithubHook')

  dataArgs[1](REQ_ONE)
  dataArgs[1](REQ_TWO)
  endArgs[1]()

  args = writeHeadCall.calls[0].args
  assert.equal(2, args.length)
  assert.equal(200, args[0])
  assert.equal('object', typeof args[1])

  args = onGithubHookCall.calls[0].args

  assert.equal(2, args.length)
  assert.equal('object', typeof args[0])
  assert.equal('refs/heads/master', args[0].ref)
  assert.equal(REQUEST.url.slice(1), args[1])
})

test.describe("server#request bad path", function () {
  var REQUEST  = test.object('request')
    , RESPONSE = test.object('response')
    , args, writeHeadCall

  REQUEST.url = '/badpath'

  writeHeadCall = test.expect(RESPONSE, 'writeHead')
  test.expect(RESPONSE, 'end', ['Not found'])

  createServerCall.calls[0].args[0](REQUEST, RESPONSE)

  args = writeHeadCall.calls[0].args
  assert.equal(2, args.length)
  assert.equal(404, args[0])
  assert.equal('object', typeof args[1])
})

test.describe('exports#onGithubHook', function () {
  var JSON_OBJ     = JSON.parse(JSON_STRING.trim())
    , WRITE_STREAM = test.object('write_stream')
    , now          = new Date().toISOString()
    , LOGNAME      = now + '-' + JSON_OBJ.after.slice(0, 7)
    , LOGPATH      = path.join(EXPORTS.config.secretpath.logdir, LOGNAME)
    , createWriteStreamCall, pipeCall, args, execCall

  CHILD.stdout = test.object('stdout')
  CHILD.stderr = test.object('stderr')

  execCall = test.expect
    ( test.required.child_process
    , 'exec'
    , 1
    , [   EXPORTS.config.secretpath.command
        + ' "' + JSON_OBJ.after + '"'
        + ' "' + JSON_OBJ.ref + '"'
        + ' "' + JSON_OBJ.repository.owner.name + '"'
        + ' "' + JSON_OBJ.repository.name + '"'
      ]
    , CHILD
    )

  test.expect(
    test.required.path
  , 'join'
  , 1)
    .andReturn(LOGPATH)

  createWriteStreamCall = test.expect(
    test.required.fs
  , 'createWriteStream'
  , 1
  , [LOGPATH + '.log'])
    .andReturn(WRITE_STREAM)

  test.expect(CHILD.stdout, 'pipe', 1, [WRITE_STREAM])
  pipeCall = test.expect(CHILD.stderr, 'pipe', 1)

  EXPORTS.onGithubHook(JSON_OBJ, 'secretpath')

  args = pipeCall.calls[0].args
  assert.equal(2, args.length)
  assert.equal(WRITE_STREAM, args[0])
  assert.deepEqual(
    { end: false
    }
  , args[1])
})

test.describe('exports#onGithubHook bad branch', function () {
  var JSON_OBJ = JSON.parse(JSON_STRING.trim())

  JSON_OBJ.ref = 'refs/heads/bad'

  EXPORTS.onGithubHook(JSON_OBJ, 'secretpath')
})

test.describe('exports#onGithubHook no branch no logdir', function () {
  var JSON_OBJ     = JSON.parse(JSON_STRING.trim())
    , execCall, args

  execCall = test.expect(
    test.required.child_process
  , 'exec'
  , 1
  ,   EXPORTS.config.secretpath.command
    + ' "' + JSON_OBJ.after + '"'
    + ' "' + JSON_OBJ.ref + '"'
    + ' "' + JSON_OBJ.repository.owner.name + '"'
    + ' "' + JSON_OBJ.repository.name + '"')
    .andReturn(CHILD)

  EXPORTS.config.secretpath.branch = undefined
  EXPORTS.config.secretpath.logdir = undefined

  EXPORTS.onGithubHook(JSON_OBJ, 'secretpath')
})

test.describe('server#listen', function () {
  var args = listenCall.calls[0].args

  assert.equal(1, args.length)
  assert.equal('number', typeof args[0])
})

