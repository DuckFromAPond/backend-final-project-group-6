let dbProvider = null;

function setDbProvider(provider) {
  dbProvider = provider;
}

function getDbProvider() {
  return dbProvider;
}

module.exports = {
  setDbProvider,
  getDbProvider
};