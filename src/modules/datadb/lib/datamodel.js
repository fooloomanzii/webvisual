var DataModel = function(cnf) {
  this.date = cnf.date,
  this.id = cnf.id,
  this.roomNr = cnf.roomNr,
  this.room = cnf.room,
  this.kind = cnf.kind,
  this.method = cnf.method,
  this.value = cnf.value,
  this.isBoolean = cnf.isBoolean,
  this.threshold = cnf.threshold,
  this.unit = cnf.unit
};

module.exports = DataModel;
