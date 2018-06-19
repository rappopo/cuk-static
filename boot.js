'use strict'

const koaStatic = require('koa-static')
const favicon = require('koa-favicon')

module.exports = function(cuk){
  const pkgId = 'static'
  const { _, fs, path, helper, debug } = cuk.lib
  const { app, mount } = cuk.pkg.http.lib
  const pkg = cuk.pkg[pkgId]
  const staticAppDir = path.join(cuk.dir.app, 'cuks', pkgId, 'resource')

  fs.ensureDirSync(staticAppDir)

  const serve = (dir, options) => {
    return koaStatic(dir, helper('core:makeOptions')(pkgId, 'options', options))
  }

  pkg.lib.serve = serve

  const mountDir = function(kv, root, pid) {
    if (_.isEmpty(kv)) return
    _.forOwn(kv, (v, k) => {
      if (!path.isAbsolute(v)) {
        let _v = path.join(root, v)
        if (!fs.existsSync(_v))
          _v = path.join(cuk.dir.app, v)
        v = _v
      }
      if (!fs.existsSync(v)) return
      let mp = pkg.cfg.common.mount + (pid ? `${pid === '/' ? '':pid}` : '') + k
      if ((pkg.cfg.common.disabled || []).indexOf(mp) > -1) {
        helper('core:bootTrace')(`%A Disabled %K ${mp} %L ${helper('core:makeRelDir')(v, cuk.dir.app, 'ADIR:.')}`, null, null, null)
        return
      }
      app.use(mount(mp, serve(v)))
      helper('core:bootTrace')(`%A Enabled %K ${mp} %L ${helper('core:makeRelDir')(v, cuk.dir.app, 'ADIR:.')}`, null, null, null)
    })
  }

  return new Promise((resolve, reject) => {
    let faviconDef = path.join(pkg.dir, 'cuks', pkgId, 'resource', 'favicon.ico'),
      faviconFile = path.join(staticAppDir, 'favicon.ico')
    if (!fs.existsSync(faviconFile)) faviconFile = faviconDef
    app.use(favicon(faviconFile))
    helper('core:bootTrace')(`%A Enabled %K favicon.ico %L %s`, helper('core:makeRelDir')(null, null, null, faviconFile))
    _.forOwn(cuk.pkg, (v, k) => {
      let dir = path.join(v.dir, 'cuks', pkgId, 'resource'),
        mp = `${pkg.cfg.common.mount}${v.cfg.common.mount === '/' ? '' : ('/' + v.id)}`
      if (!fs.existsSync(dir)) return
      if ((pkg.cfg.common.disabled || []).indexOf(mp) > -1) {
        helper('core:bootTrace')(`%A Disabled %K ${mp} %L ${helper('core:makeRelDir')(dir, cuk.dir.app, 'ADIR:.')}`, null, null, null)
        return
      }
      if (mp === pkg.cfg.common.mount) {
        let mws = [helper('http:composeMiddleware')(_.get(pkg.cfg, 'cuks.http.middleware', []), `${pkg.id}:*`)]
        mws.push(serve(dir))
        app.use(mount(mp, cuk.pkg.http.lib.compose(mws)))
      } else {
        app.use(mount(mp, serve(dir)))
      }
      helper('core:bootTrace')(`%A Enabled %K ${mp} %L ${helper('core:makeRelDir')(dir, cuk.dir.app, 'ADIR:.')}`, null, null, null)
    })
    Promise.map(helper('core:pkgs')(), function(p) {
      return new Promise((resv, rejc) => {
        let dir = path.join(p.dir, 'cuks', pkgId)
        helper('core:loadConfig')(dir, 'resource')
        .then(result => {
          mountDir(result, p.dir, '/' + p.id)
          resv(true)
        })
      })
    })
    .then(resolve)
    .catch(reject)
  })

}