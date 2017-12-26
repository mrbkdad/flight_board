var express = require('express');
var router = express.Router();

var connection = require('./db/connection');

//yyyy-mm-dd 형식 데이터와 날짜 차이값을 받아 해당 날짜 리턴
//예 getDate('2017-11-11',2)
function getDate(dd,delta){
  var moment = require('moment');
  var _date = moment(dd,'YYYY-MM-DD');
  _date.add(delta,'days');
  return _date.format('YYYY-MM-DD');
}

function check_dept(port){
  var info = {
    GMP:"('5100','5200','5300')",
    ICN:"('6100','6200','6300')",
    CJU:"('3300')",
    CJJ:"('3200')",
    PUS:"('3400')",
    ETC:"('3000','3100')"
  }
  if(info[port]){
    return info[port];
  }else{
    return info['ETC'];
  }
}

/* GET home page. */
router.get('/:station', function(req, res, next) {
  var port = req.params.station;
  var dept_code = check_dept(port);
  console.log('/job_workers',req.params);
  var query = `SELECT EmpCode, EmpName
              FROM EmpMaster
              WHERE DefaultDeptCode in  ${dept_code}
              ORDER BY EmpName`;
  console.log(query);

  connection.runQuery(query, function(err, recordset) {
     // call callback
     var result = {};
     result['result'] = 1;
     result['data'] = recordset;
     res.send(result);
  });
});

module.exports = router;
