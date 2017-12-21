// init value
var svg_w = 1800;//board size
var pad_left = 80, pad_right = 30, pad_top = 30, pad_bottom = 30;
var box_h = 60;
var box_min = 70; // min width of box

// time scale
var xscale_start = '03:00';
var xscale_end = '30:00'; //04시
var xscale_ticks = 28; //x축의 갯수
var parseTime = d3.timeParse("%Y-%m-%d %H:%M");

// svg 객체
var svg = null;
// Scale 객체
var x_scale = null;
var y_scale = null;
// event function -- ajax
function select_event(){
  var sel_date = d3.select('#log_date').property('value');
  var sel_station = d3.select('#station').property('value');
  var json_url = '/flight_plan/'+sel_date+'/'+sel_station;
  d3.json(json_url,function(err,data){
    if(err){
      console.log(err)
      console.log(data)
      alert('Server Internal Error, please email to system administrator!')
    }else{
      console.log(data.plan)
      plot_data = data.plan
      draw_plot(sel_date,data.plan)
    }
  });
}

// event function -- reload
function flight_board(){
  var sel_date = d3.select('#log_date').property('value');
  var sel_station = d3.select('#station').property('value');
  var url = "/flight_board/" + sel_date + "/" + sel_station;
  //alert(url);
   $(location).attr('href', url);
   window.location = url;
}

// draw board
function draw_plot(sel_date,draw_data){
  var hl_set = new Set();
  draw_data.forEach(function(d){hl_set.add(d.ACNumber);});
  // y scale size 조정, hl# list 갯수만큼 생성 할 수 있도록
  var svg_height = (box_h+40)*(hl_set.size) + pad_top+pad_bottom;

  svg = init_draw(svg_w,svg_height);
  svg.selectAll("g").remove();


  var x_extent = [parseTime(sel_date +' '+xscale_start),parseTime(sel_date +' '+xscale_end)];
  var y_extent = [0,hl_set.size];
  x_scale = d3.scaleTime().range([pad_left,svg_w-pad_right])
      .domain(x_extent).clamp(true);// 값 범위 초과시 처리 옵션
  var x_axis = d3.axisTop(x_scale).tickSize(-(svg_height-pad_top-pad_bottom)).ticks(xscale_ticks);
  y_scale = linear_scale(y_extent,[pad_bottom,svg_height-pad_top]);
  var y_axis =  d3.axisLeft(y_scale).tickSize(-(svg_w-pad_left-pad_right)).ticks(hl_set.size);

  //x 축 그리기
  svg.append("g").attr("class", "x_axis")
    .attr("transform", "translate(0," + pad_top + ")").call(x_axis);
  // y 축 그리기
  svg.append("g").attr("id","y_axis")
    .attr("transform","translate("+pad_left+","+0+")").call(y_axis);
  // HLNumber 표시
  var hl_map = {};
  var i = 1;
  Array.from(hl_set).sort().forEach(function(d){
    draw_text(svg.append("g"),0,y_scale(i)-box_h/2,d).attr("font-size",20);
    hl_map[d] = i;
    i++;
  });

  //플라이트 정보 박스를 그려준다.
  draw_data.forEach(function(d){
    var start_time = d.StandardTimeDeparture.replace('T',' ').substring(0,16);
    var end_time = d.StandardTimeArrival.replace('T',' ').substring(0,16);
    var x1 = x_scale(parseTime(start_time));
    var x2 = x_scale(parseTime(end_time));
    var y = y_scale(hl_map[d.ACNumber])
    var info = d.ACNumber+"/"+d.FlightNumber+"/"
      +d.RouteFrom+"/"+d.RouteTo+"/"
      +start_time+"/"+end_time;
    var box_w = x2 - x1
    if(box_w < box_min){
      box_w = box_min;
    }

    var box_g = draw_box(svg,d.ACNumber+'_'+d.FlightNumber,
      {
        x:x1,
        y:y,
        width:box_w,
        height:box_h,
        from:d.RouteFrom,
        to:d.RouteTo,
        info:info,
    });

    // 정보 출력
    // 1. flight mumber 가운데 출력
    // 2. 출도착지 하단 앞 뒤 출력
    // 3. 시간 출력 상단 앞 뒤 출력
    // 4. 작업자 정보 출력용 표시(빈값으로) - 이후 정보가 있을경우 처리
    // text-anchor 속성을 이용하여 위치 조정
    draw_text(box_g,box_w/2,box_h/2+10,d.FlightNumber)
      .attr('text-anchor','middle')
      .attr("id","FlightNumber").attr("font-size",box_w>100?"30":"20");
    draw_text(box_g,2,box_h-5,d.RouteFrom)
      .attr('text-anchor','start')
      .attr("id","RouteFrom").attr("font-size","14");
    draw_text(box_g,box_w-2,box_h-5,d.RouteTo)//2+box_w-33
      .attr('text-anchor','end')
      .attr("id","RouteTo").attr("font-size","14");
    draw_text(box_g,2,box_h/4-2,start_time.substr(11))
      .attr('text-anchor','start')
      .attr("id","start_time").attr("font-size","12");
    draw_text(box_g,box_w-2,box_h/4-2,end_time.substr(11))//box_w-31
      .attr('text-anchor','end')
      .attr("id","end_time").attr("font-size","12");
    draw_text(box_g,0,-10,'').attr("id","worker1")//worker1
    .attr('text-anchor','middle')
    .attr("font-size","14").attr("font-weight","10");
    draw_text(box_g,box_w,-10,'').attr("id","worker2")//worker2
    .attr('text-anchor','middle')
    .attr("font-size","14").attr("font-weight","10");

    // 실 출도착 시간 처리
    draw_text(box_g,2,box_h/3+4,'')
      .attr('text-anchor','start')
      .attr("id","sch_start_time").attr("font-size","12")
      .attr("fill","darkred");//.attr("opacity",0.9);
    draw_text(box_g,box_w-2,box_h/3+4,'')//box_w-31
      .attr('text-anchor','end')
      .attr("id","sch_end_time").attr("font-size","12")
      .attr("fill","darkred").attr("opacity",0.9);


  });
  // 현재 시간 표시 라인 그리기
  var now = new Date();
  var hh = now.getHours();
  hh = hh>9?''+hh:'0'+hh;
  var mm = now.getMinutes();
  mm = mm>9?''+mm:'0'+mm;
  var x_point = x_scale(parseTime(sel_date + ' ' + hh + ':'+mm));
  draw_line(svg.append("g"),x_point,x_point,0,parseFloat(svg.attr('height')))
  .style('stroke','red')
  .style('stroke-width','4px')
  .style('stroke-dasharray','5 5')
  .style('opacity',0.5);
}

function init_draw(w,h){
  return d3.select("svg").attr("width",w).attr("height",h);
}
// domain extent와 range extent를 이용하여 linear scale 생성
function linear_scale(d_extent,r_extent){
  return d3.scaleLinear().domain(d_extent).range(r_extent);
}
// r,x,y 값 형태의 데이터를 받아 color 로 circle plot
function draw_circle(p_obj,cname,cdata,ccolor){
  p_obj.append("g").selectAll(cname).data(cdata).enter()
    .append("circle").attr("class",cname+"_circle")
    .attr("r",function(d){ return d.r;})
    .attr("cx",function(d){return d.x;})
    .attr("cy",function(d){return d.y;})
    .attr("fill",ccolor);
}

// x,y,width,height 값 형태의 데이터를 box plot
function draw_box(p_obj,cname,cdata){
  var box_g = p_obj.append("g").attr("class","box").attr("id",cname)
    .attr("transform", "translate("+cdata.x+","+(cdata.y-box_h)+")");
  box_g.append("rect").attr("id",cname+"_rect").attr("class",check_route(cdata.from,cdata.to))//.attr("class","range")
    .attr("width",cdata.width).attr("height",cdata.height)
    //.attr("y",-cdata.height/2)//.attr("x",-cdata.width/2)
    .attr("info",cdata.info)
    .on("click",click_flight);
  return box_g;
}
function draw_line(p_obj,x1,x2,y1,y2){
  return p_obj.append("line").attr("class","box_line")
    .attr("x1",x1).attr("x2",x2).attr("y1",y1).attr("y2",y2);
}
function draw_text(p_obj,x,y,text,cls="draw_text"){
  return p_obj.append("text").attr("class",cls)
    .attr("x",x).attr("y",y).text(text);
}
var selected_box = undefined;
function click_flight(){
  //console.log(d3.select(this).attr("info"));
  //alert(d3.select(this).attr("info"));
  selected_box = d3.select(this);
  var infos = d3.select(this).attr("info").split("/");
  var information = "<b>상세정보</b> : "+infos[0]+" / "+infos[1]+" / "+
        infos[2]+"-"+infos[3]+" / "+infos[4]+"~"+infos[5];

  d3.select("#job_from").property("value",infos[5].substr(11));
  d3.select("#job_to").property("value",infos[5].substr(11));
  d3.select("#flight_info #information").html(information);
  d3.select("#flight_info").attr("class","info_visible");
}

function yyyymmdd(date,del="-")
{
  // Date => YYYY-MM-DD 형식의 문자열로
  var sYear = date.getFullYear();
  var sMonth = date.getMonth() + 1;
  var sDate = date.getDate();

  sMonth = sMonth > 9 ? sMonth : "0" + sMonth;
  sDate  = sDate > 9 ? sDate : "0" + sDate;
  return sYear + del + sMonth + del + sDate;
}
