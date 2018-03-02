var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'EastarJet Flight Plotting Board System!' });
});

router.get('/help', function(req, res, next) {
  res.render('help', { title: 'EastarJet Flight Plotting Board System!' });
});

router.post('/board',function(req,res,next){
  res.redirect('/daily_flight_board.html');
});

module.exports = router;
