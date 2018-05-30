'use strict'

const koaStatic = require('koa-static')
const favicon = require('koa-favicon')

module.exports = function(cuk){
  const pkgId = 'static'
  const { _, fs, path, helper, debug } = cuk.lib
  const { app, mount } = cuk.pkg.http.lib
  const pkg = cuk.pkg[pkgId]
  const staticDir = path.join(cuk.dir.root, 'cuks', pkgId)
  const trace = debug(`cuk:${pkgId}`)

  const serve = function(dir, options) {
    return koaStatic(dir, helper.makeOptions(pkgId, 'options', options))
  }

  trace('Initializing...')
  pkg.lib = {
    serve: serve
  }

  const mountDir = function(kv, root, pid) {
    if (_.isEmpty(kv)) return
    _.forOwn(kv, (v, k) => {
      if (!path.isAbsolute(v)) {
        let _v = path.join(root, v)
        if (!fs.existsSync(_v))
          _v = path.join(cuk.dir.root, v)
        v = _v
      }
      if (!fs.existsSync(v)) return
      let mp = pkg.cfg.mount + (pid ? `/${pid}` : '') + k
      if ((pkg.cfg.disabled || []).indexOf(mp) > -1) {
        trace(`Disabled » ${mp} -> ${helper.makeRelDir(v, cuk.dir.root)}`)
        return
      }
      app.use(mount(mp, serve(v)))
      trace(`Enabled » ${mp} -> ${helper.makeRelDir(v, cuk.dir.root)}`)
    })
  }

  return new Promise((resolve, reject) => {
    // 1. favicon
    let faviconDef = path.join(pkg.dir, 'cuks', pkgId, 'favicon.ico'),
      faviconFile = path.join(staticDir, 'favicon.ico')
    if (!fs.existsSync(faviconFile)) faviconFile = faviconDef
    app.use(favicon(faviconFile))
    trace(`Serve » favicon.ico -> %s`, helper.makeRelDir(faviconFile))
    // 2. app's static
    fs.ensureDirSync(staticDir)
    if ((pkg.cfg.disabled || []).indexOf(pkg.cfg.mount) > -1) {
      trace(`Disabled » ${pkg.cfg.mount} -> ${helper.makeRelDir(staticDir)}`)
    } else {
      app.use(mount(pkg.cfg.mount, serve(staticDir)))
      trace(`Enabled » ${pkg.cfg.mount} -> ${helper.makeRelDir(staticDir)}`)
    }
    // 3. any other app's static
    helper.getFromJsOrJson(cuk.dir.root, 'cuks', pkgId)
    .then(result => {
      mountDir(result, cuk.dir.root)
      return Promise.resolve(true)
    })
    .then(() => {
      // 4. pkg's statics
      _.forOwn(cuk.pkg, (v, k) => {
        let dir = path.join(v.dir, 'cuks', pkgId),
          mp = `${pkg.cfg.mount}/${k}`
        if (!fs.existsSync(dir)) return
        if ((pkg.cfg.disabled || []).indexOf(mp) > -1) {
          trace(`Disabled » ${mp} -> ${helper.makeRelDir(dir)}`)
          return
        }
        app.use(mount(mp, serve(dir)))
        trace(`Enabled » ${mp} -> ${helper.makeRelDir(dir)}`)
      })
      return Promise.resolve(true)
    })
    .then(() => {
      // 5. any other pkg's statics
      return Promise.map(helper.getPkgs(), function(p) {
        return new Promise((resv, rejc) => {
          let dir = path.join(p.dir, 'cuks')
          helper.getFromJsOrJson(dir, pkgId)
          .then(result => {
            mountDir(result, p.dir, p.id)
            resv(true)
          })
        })
      })
    })
    .then(resolve)
    .catch(reject)
  })

}