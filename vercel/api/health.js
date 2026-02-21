const { send } = require('../lib/http');
const { hasKV } = require('../lib/store');

module.exports = async (req, res) => {
  send(res, 200, { ok: true, service: 'tcg-vercel', kv: hasKV() });
};
