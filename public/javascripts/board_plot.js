// init value
var svg_w = 1800;//board size
var svg_h_unit = 30;//adjust board height
var pad_left = 80, pad_right = 30, pad_top = 30, pad_bottom = 30;
var box_h = 55;
var box_min = 70; // min width of box
var msg_mark = '@';//text icon

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

// HLNumber 표시
var hl_map = {};

// event function -- ajax
function select_event(){
  var sel_date = d3.select('#log_date').property('value');
  var sel_station = d3.select('#station').property('value');
  var json_url = '/flight_plan/'+sel_date+'/'+sel_station;
  d3.json(json_url,function(err,data){
    if(err){
      console.log(err);
      console.log(data);
      alert('Server Internal Error, please email to system administrator!')
    }else{
      console.log(data.plan);
      plot_data = data.plan;
      draw_plot(sel_date,data.plan);
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
function draw_plot(sel_date,sel_station,draw_data){
  // initialize worker bubble window
  init_jobworker_bubble();
  init_lovchk_bubble();

  var hl_set = new Set();
  draw_data.forEach(function(d){hl_set.add(d.ACNumber);});
  // y scale size 조정, hl# list 갯수만큼 생성 할 수 있도록
  var svg_height = (box_h+svg_h_unit)*(hl_set.size) + pad_top+pad_bottom;

  svg = init_draw(svg_w,svg_height);
  svg.selectAll("g").remove();


  var x_extent = [parseTime(sel_date +' '+xscale_start),parseTime(sel_date +' '+xscale_end)];
  var y_extent = [0,hl_set.size];
  x_scale = d3.scaleTime().range([pad_left,svg_w-pad_right])
      .domain(x_extent).clamp(true);// 값 범위 초과시 처리 옵션
  var x_axis = d3.axisTop(x_scale)
    .tickFormat(d3.timeFormat("%H:%M")) //24시간 형식
    .tickSize(-(svg_height-pad_top-pad_bottom)).ticks(xscale_ticks);
  y_scale = linear_scale(y_extent,[pad_bottom,svg_height-pad_top]);
  var y_axis =  d3.axisLeft(y_scale).tickSize(-(svg_w-pad_left-pad_right)).ticks(hl_set.size);

  //x 축 그리기
  svg.append("g").attr("class", "x_axis")
    .attr("transform", "translate(0," + pad_top + ")").call(x_axis);
  // y 축 그리기
  svg.append("g").attr("id","y_axis")
    .attr("transform","translate("+pad_left+","+0+")").call(y_axis);
  // HLNumber 표시
  //var hl_map = {};
  var i = 1;
  Array.from(hl_set).sort().forEach(function(d){
    let hl_g = svg.append("g").attr('id',d);
    draw_text(hl_g,0,y_scale(i)-box_h/2,d)
      .attr('id','ACNumber').attr("font-size",20);
    //Flight Detail info : ACModel, ACSerialNumber
    draw_text(hl_g,0,y_scale(i)-box_h/2+12,'EffectivityIPC')
      .attr('id','EffectivityIPC').attr("font-size",14);
    draw_text(hl_g,0,y_scale(i)-box_h/2+24,'Wheel')
      .attr('id','Wheel').attr("font-size",14);
    hl_map[d] = i;
    i++;
  });
  //read detail for hl and show
  d3.json('/info/flight_info',(err,data)=>{
    //console.log(data);
    data.data.recordsets[0].forEach((d)=>{
      //console.log(d.LineNumber,d.EffectivityIPC);
  	   if(hl_set.has(d.ACNumber)){
         d3.select('#'+d.ACNumber).select('#EffectivityIPC').text(d.EffectivityIPC);
         d3.select('#'+d.ACNumber).select('#Wheel').text(d.Wheel);
       }
     });
  });

  //플라이트 정보 박스를 그려준다.
  draw_data.forEach(function(d){
    var start_time = d.StandardTimeDeparture.replace('T',' ').substring(0,16);
    var end_time = d.StandardTimeArrival.replace('T',' ').substring(0,16);
    var x1 = rtime_to_postion(d.StandardTimeDeparture);//x_scale(parseTime(start_time));
    var x2 = rtime_to_postion(d.StandardTimeArrival);//x_scale(parseTime(end_time));
    var y = acnumber_to_postion(d.ACNumber);// y_scale(hl_map[d.ACNumber])

    var info = d.ACNumber+"/"+d.FlightNumber+"/"+
      d.RouteFrom+"/"+d.RouteTo+"/"+
      start_time+"/"+end_time;
    var box_w = x2 - x1;
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
    }).datum(d);// data binding
    box_g.on('mouseover',(d)=>{
      var msg = box_g.attr('msg-tooltip');//job descriptions
      //console.log(msg);
      if((msg!==null) & (msg!=="")){
        bubble_show(d3.event.pageX+20,d3.event.pageY-60,show_msg(msg));
      }
    }).on('mouseout',(d)=>{bubble_hide();});


    // 정보 출력
    // 1. flight mumber 가운데 출력
    // 2. 출도착지 하단 앞 뒤 출력
    // 3. 시간 출력 상단 앞 뒤 출력
    // 4. 작업자 정보 출력용 표시(빈값으로) - 이후 정보가 있을경우 처리
    // 5. flight msg - 박스 아래
    // 6. 출도착 시간 업데이트 - 기존 시간 아래 붉은색 표시
    // 7. 게이트 표시 - 출도착 공항 옆에 표시
    // text-anchor 속성을 이용하여 위치 조정
    draw_text(box_g,box_w/2,box_h/2+10,d.FlightNumber)
      .attr('text-anchor','middle')
      .attr("id","FlightNumber_"+d.FlightNumber).attr("font-size",box_w>100?"28":"19")
      //mouse click event
      .on('click',show_worker);
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
    // 작업자 3명 표시 - 보내는자(D), 받는자(A), 탑승지원(B)
    draw_text(box_g,box_w/2,-10,'',cls='worker_text').attr("id","workerB")//worker
    .attr('text-anchor','middle')
    .attr("font-size","14").attr("font-weight","10")
    // 작업자 코드, sub 작업자 이름과 코드 설정
    .attr('empcd','').attr('sub_empnm','').attr('sub_empcd','')
    .on('mouseover',(d)=>{//mouse over tooltip
      //console.log(d);
      bubble_show(d3.event.pageX + 5,d3.event.pageY - 50,
        show_emp(d3.select('#'+d.ACNumber+'_'+d.FlightNumber).select('#workerB').attr('empcd'),
        d3.select('#'+d.ACNumber+'_'+d.FlightNumber).select('#workerB').attr('sub_empnm'))
      );
    }).on("mouseout", function(d) {
      bubble_hide();
       //d3.select('#tooltip_div').transition().duration(500).style("opacity", 0);
    });
    draw_text(box_g,0,-10,'',cls='worker_text').attr("id","workerD")//worker1
    .attr('text-anchor','middle')
    .attr("font-size","14").attr("font-weight","10")
    // 작업자 코드, sub 작업자 이름과 코드 설정
    .attr('empcd','').attr('sub_empnm','').attr('sub_empcd','')
    .on('mouseover',(d)=>{//mouse over tooltip
      //console.log(d);
      bubble_show(d3.event.pageX + 5,d3.event.pageY - 50,
        show_emp(d3.select('#'+d.ACNumber+'_'+d.FlightNumber).select('#workerD').attr('empcd'),
        d3.select('#'+d.ACNumber+'_'+d.FlightNumber).select('#workerD').attr('sub_empnm'))
      );
    }).on("mouseout", function(d) {
      bubble_hide();
       //d3.select('#tooltip_div').transition().duration(500).style("opacity", 0);
    });
    draw_text(box_g,box_w,-10,'',cls='worker_text').attr("id","workerA")//worker2
    .attr('text-anchor','middle')
    .attr("font-size","14").attr("font-weight","10")
    // 작업자 코드, sub 작업자 이름과 코드 설정
    .attr('empcd','').attr('sub_empnm','').attr('sub_empcd','')
    .on('mouseover',(d)=>{//mouse over tooltip
      //console.log(d);
      bubble_show(d3.event.pageX + 5,d3.event.pageY - 50,
        show_emp(d3.select('#'+d.ACNumber+'_'+d.FlightNumber).select('#workerA').attr('empcd'),
        d3.select('#'+d.ACNumber+'_'+d.FlightNumber).select('#workerA').attr('sub_empnm'))
      );
    }).on("mouseout", function(d) {
      bubble_hide();
       //d3.select('#tooltip_div').transition().duration(500).style("opacity", 0);
    });
    // flight msg 고정용
    draw_text(box_g,box_w/2,box_h+10,'')
      .attr('text-anchor','middle').style('fill','darkred')
      .attr("id","flight_msg").attr("font-size","14");

    // 실 출도착 시간 처리용
    draw_text(box_g,2,box_h/3+4,'')
      .attr('text-anchor','start')
      .attr("id","sch_start_time").attr("font-size","12")
      .attr("fill","darkred");//.attr("opacity",0.9);
    draw_text(box_g,box_w-2,box_h/3+4,'')//box_w-31
      .attr('text-anchor','end')
      .attr("id","sch_end_time").attr("font-size","12")
      .attr("fill","darkred").attr("opacity",0.9);
    // 게이트 번호 표시
    draw_text(box_g,-1,box_h-5,"")
      .attr('text-anchor','end')
      .attr("id","GateFrom_"+d.FlightNumber).attr("font-size","13");
    draw_text(box_g,box_w+1,box_h-5,"")//2+box_w-33
      .attr('text-anchor','start')
      .attr("id","GateTo_"+d.FlightNumber).attr("font-size","13");

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

  // 배정된 작업자 정보 읽어서 표시
  d3.json('/job_workers/workers/'+sel_date+'/'+sel_station,(err,data)=>{
    data.recordset.recordset.forEach((d)=>{
      //console.log(d);
      var sel_worker = d3.select('#'+d.ACNumber+'_'+d.FlightNumber).select('#worker'+d.OperationType);
      if(d.ResponsibilityType == 'M'){
        sel_worker.attr('empcd',d.EmpCode).text(d.EmpName);
      }else if (d.ResponsibilityType == 'S') {
        sel_worker.attr('sub_empcd',d.EmpCode).attr('sub_empnm',d.EmpName);
      }
    });
  });
  // 입력된 메시지 정보 읽어소 표시
  d3.json('/job_descs/'+sel_date+'/'+sel_station,(err,data)=>{
    data.recordset.recordset.forEach((d)=>{
      //console.log(d);
      var sel_parent = d3.select('#'+d.ACNumber+'_'+d.FlightNumber);
      if(d.OperationType == 'M'){//main description
        sel_parent.attr('msg-tooltip',d.Remarks);
        sel_parent.select('#flight_msg').text(msg_mark);
      }else if(d.OperationType == 'C'){//LOV check
        sel_parent.attr('daily_check','true');
        show_lov_check(sel_parent,d.Remarks);
      }
    });
  });

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
//Initialize Job Worker bubble window
function init_jobworker_bubble(){
  d3.select('#job_workers').remove();
  let bubble_window = d3.select('body').append('div').attr('id','job_workers')
    .style('display','none').style('position','absolute').style('height','15px');
  bubble_window.append('input').attr('id','is_main').attr('name','is_main')
    .attr('type','checkbox').property('value','M').property('checked',true);
  bubble_window.append('label').text('m-');
  bubble_window.append('select')
    .attr('id','worker').attr('name','worker')
    .append('option').attr('value','000000').text('작업자');
  bubble_window.append('button')
    .attr('id','save_workerD').text('D');//.attr('disabled',true);
  bubble_window.append('button')
    .attr('id','save_workerB').text('B');
  bubble_window.append('button')
    .attr('id','save_workerA').text('A');
  bubble_window.append('button')
    .attr('id','save_all').text('S');
  //bubble_window.append('button')
  //  .attr('id','show_msg').text('↓');
  bubble_window.append('button')
    .attr('id','close_worker').text('x');
  let msg_div = bubble_window.append('div').attr('id','msg_div')
    .attr('align','center');//.style('display','none');
  msg_div.append('input').attr('size','25').attr('id','job_msg')
  .attr('type','text').style('height','18px');
  msg_div.append('button')
    .attr('id','save_msg').text('M');
  msg_div.append('button')
    .attr('id','daily_check').text('C');
  //msg_div.append('button')
  //  .attr('id','hide_msg').text('↑');
}
function show_worker(d){
    //var start_time = d.StandardTimeDeparture.replace('T',' ').substring(0,16);
    //var end_time = d.StandardTimeArrival.replace('T',' ').substring(0,16);
    var x1 = rtime_to_postion(d.StandardTimeDeparture);//x_scale(parseTime(start_time));
    var x2 = rtime_to_postion(d.StandardTimeArrival);//x_scale(parseTime(end_time));
    var y = acnumber_to_postion(d.ACNumber);// y_scale(hl_map[d.ACNumber])
    var temp_top = d3.select('#controls').style('height');
    var temp_g = d3.select('#'+d.ACNumber+'_'+d.FlightNumber);
    var sel_station = d3.select('#station').property('value')
    var workers_top = parseFloat(temp_top)+y+5;
    var workers_left = x1+10;
    // setup data
    d3.json('/job_workers/'+sel_station,(err,data)=>{
      //console.log(data.data.recordset);
      var worker_options = d3.select('#job_workers').select('#worker');
      worker_options.selectAll('option').remove();
      data.data.recordset.forEach((record)=>{
      	worker_options.append('option')
          .attr('value',record['EmpCode']).text(record['EmpName']);
      });
    });
    //console.log(workers_top,workers_left);
    d3.select('#job_workers').style('top',workers_top+'px')
      .style('left',workers_left+'px')
      .style('display','block');
    //button select_event
    d3.select('button#save_workerD').on('click',(d,i,n)=>{
      set_worker(temp_g,'D');
    });
    d3.select('button#save_workerA').on('click',(d,i,n)=>{
      set_worker(temp_g,'A');
    });
    d3.select('button#save_workerB').on('click',(d,i,n)=>{
      set_worker(temp_g,'B');
    });
    d3.select('button#close_worker').on('click',(d,i,n)=>{
      d3.select('#job_workers').style('display','none');
    });
    d3.select('button#save_all').on('click',(d,i,n)=>{
      //d3.select('#job_workers').style('display','none');
      save_workers(temp_g);
    });
    d3.select('button#daily_check').on('click',(d,i,n)=>{
      //daily_check
      set_lov_check(temp_g,0);// set default lov
    });
    d3.select('button#show_msg').on('click',(d,i,n)=>{
      d3.select('#msg_div').style('display','block');
    });
    d3.select('button#hide_msg').on('click',(d,i,n)=>{
      d3.select('#msg_div').style('display','none');
    });
    d3.select('button#save_msg').on('click',(d,i,n)=>{
      var msg = d3.select('#job_msg').property('value');
      temp_g.attr('msg-tooltip',msg);
      temp_g.select('#flight_msg').text(msg_mark);
      save_descs(temp_g);// save descriptions
    });
}
// save workers
function save_workers(parent){
  console.log(parent.data());
  let p_data = parent.data()[0];
  let save_data = {
    FlightPlanID:p_data.FlightPlanID,
    ACNumber:p_data.ACNumber,
    WorkerList:[]
  };
  save_data.WorkerList.push([parent.select('#workerA').attr('empcd'),'A','M']);
  save_data.WorkerList.push([parent.select('#workerA').attr('sub_empcd'),'A','S']);
  save_data.WorkerList.push([parent.select('#workerB').attr('empcd'),'B','M']);
  save_data.WorkerList.push([parent.select('#workerB').attr('sub_empcd'),'B','S']);
  save_data.WorkerList.push([parent.select('#workerD').attr('empcd'),'D','M']);
  save_data.WorkerList.push([parent.select('#workerD').attr('sub_empcd'),'D','S']);
  console.log(save_data);
  d3.json('/job_workers/save',function(error, data) {
       //console.log(data);
       //처리 결과를 화면에 재정리
       parent.selectAll('.worker_text').style('fill','black');
    })
   .header("Content-Type","application/json")
   .send("POST", JSON.stringify(save_data));
}
// setting worker info on screen
function set_worker(parent,tp){
  var selected_empcd = $("select#worker option:selected").val();
  var selected_empnm = $("select#worker option:selected").text();
  var selected_worker = parent.select('#worker'+tp);
  console.log(selected_empcd);
  if(d3.select('#is_main').property('checked')){//main
    selected_worker.attr('empcd',selected_empcd)
    .style('fill','red').text(selected_empnm);
  }else{//sub
    selected_worker.attr('sub_empcd',selected_empcd)
      .style('fill','red').attr('sub_empnm',selected_empnm);
  }
}
// shwo worker detail information
function show_emp(id,sub_nm=""){
  //console.log(id);
    return function(){
      d3.json('/job_workers/info/'+id,(err,data)=>{
        var html = 'Name : '+data.data.recordset[0].EmpName +
                  '<br/>Email: ' + data.data.recordset[0].eMail +
                  '<br/>Tel : '+ data.data.recordset[0].MobileNo +
                  '<br/>Sub : '+ sub_nm;
        d3.select('#tooltip_div').html(html);
        //console.log(data.data.recordset);
      });
      //return "Name:<br/>Tel:<br/>Email:"
    }

}
// save descriptions
function save_descs(parent){
  console.log(parent.data());
  let p_data = parent.data()[0];
  let save_data = {
    FlightPlanID:p_data.FlightPlanID,
    ACNumber:p_data.ACNumber,
    OperationType:'M',
    Remarks:parent.attr('msg-tooltip')
  };
  console.log(save_data);
  d3.json('/job_descs/save',function(error, data) {
       //console.log(data);
    })
   .header("Content-Type","application/json")
   .send("POST", JSON.stringify(save_data));
}
// show daily check
function set_lov_check(parent,code){
  let daily_check = parent.attr('daily_check');
  //console.log(daily_check);
  if(daily_check && daily_check != 'false'){
    parent.attr('daily_check','false');
    parent.select('#daily_check').remove();
    save_lov_check(parent,'N',code);
  }else{
    parent.attr('daily_check','true');
    show_lov_check(parent,check_lov.value(code));
    save_lov_check(parent,'Y',code);
  }
}
function show_lov_check(parent,lov_msg){
  d3.text('/static/images/flight.svg',(d)=>{
    var x = parent.select('rect').attr('width')-30;
    var y = -25
    var daily_check = parent.append('g')
    .attr('id','daily_check')
    .attr('transform','translate('+x+','+y+')');
    daily_check.append('path').attr('d',d)
      .attr('opacity','0.5');
    draw_text(daily_check,40,80,lov_msg)
    .attr('text-anchor','start')
    .attr("id","check_txt").attr("lov",lov_msg)
    .attr("font-size","14").attr("fill","darkred")
    .on("click",show_lovchk_bubble);
  });
}
// save daily check
function save_lov_check(parent,used,code){
  console.log(parent.data());
  let p_data = parent.data()[0];
  let save_data = {
    FlightPlanID:p_data.FlightPlanID,
    ACNumber:p_data.ACNumber,
    OperationType:'C',//daily check type
    Remarks: check_lov.value(code),// LOV MSG
    Used:used
  };
  console.log(save_data);
  d3.json('/job_descs/daily_check',function(error, data) {
       //console.log(data);
       //처리 결과를 화면에 재정리
    })
   .header("Content-Type","application/json")
   .send("POST", JSON.stringify(save_data));
}
//Initialize LOV Check bubble window
function init_lovchk_bubble(){
  d3.select('#lov_checker').remove();
  let bubble_window = d3.select('body').append('div').attr('id','lov_checker')
    .style('display','none').style('position','absolute').style('height','10px');
  bubble_window.append('select')
    .attr('id','lov_chk').attr('name','lov_chk');
  check_lov.table().forEach(e => {
    bubble_window.select('#lov_chk')
    .append('option').attr('value',e[0]).text(e[1]);
  });
  bubble_window.append('button')
    .attr('id','save_lovchk').text('S');
  bubble_window.append('button')
    .attr('id','close_lovchk').text('x')
    .on("click",()=>{d3.select("#lov_checker").style("display",'none')});
}
function show_lovchk_bubble(d){
  //console.log(d);
  var x1 = rtime_to_postion(d.StandardTimeDeparture);
  var x2 = rtime_to_postion(d.StandardTimeArrival);
  var y = acnumber_to_postion(d.ACNumber);
  var temp_top = d3.select('#controls').style('height');
  var temp_g = d3.select('#'+d.ACNumber+'_'+d.FlightNumber);
  var bubble_top = y + parseFloat(temp_top) - 10;
  var bubble_left = x2+10;
  d3.select("#lov_checker")
  .style('top',bubble_top+'px')
  .style('left',bubble_left+'px')
  .style('display','block');

  var lov_checker = d3.select('#lov_checker');
  var cur_lov = temp_g.select('#daily_check #check_txt').text()
  console.log(cur_lov);
  $("select#lov_chk").val(check_lov.code(cur_lov));
  lov_checker.select('#lov_chk')

  lov_checker.select('#save_lovchk')
    .attr('id','save_lovchk').text('S')
    .on('click',()=>{
      var sel_lov = $("select#lov_chk option:selected").val();
      //console.log(sel_lov,check_lov.value(sel_lov));
      temp_g.select('#daily_check').remove();
      show_lov_check(temp_g,check_lov.value(sel_lov));
      save_lov_check(temp_g,'Y',sel_lov);
      });
}