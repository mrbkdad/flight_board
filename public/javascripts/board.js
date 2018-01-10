function check_route(from,to){
  // 출도착 노선에 따른 클래스 설정용
  // 국내선 => kor, 일본노선 => jpn, 기타 => oth
  var info = {
    kor:['GMP','CJU','CJJ','PUS','KUV','ICN'],
    jpn:['NRT','KIX','OKA','FUK','CTS','KOJ','KMI']
  }
  if(info.kor.includes(from) && info.kor.includes(to)){
    return 'kor';
  }else if (info.jpn.includes(from) || info.jpn.includes(to)) {
    return 'jpn';
  }else{
    return 'oth';
  }
  return 'oth';
}

//raw svg loader
function loadSVG(svgData){
    while(!d3.select(svgData).selectAll('path').empty()){
        d3.select('svg').node().appendChild(
            d3.select(svgData).select('path').node());
    }
    d3.selectAll('path').attr('transform','translate(50,50)');
};
