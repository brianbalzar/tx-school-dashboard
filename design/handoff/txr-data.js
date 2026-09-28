// Illustrative data + chart builders shared by the research app, brief and export frames.
// All figures are fictional. Keller ISD appears by name with illustrative numbers only.
(function () {
  const REGION_NAMES = {1:'Edinburg',2:'Corpus Christi',3:'Victoria',4:'Houston',5:'Beaumont',6:'Huntsville',7:'Kilgore',8:'Mount Pleasant',9:'Wichita Falls',10:'Richardson',11:'Fort Worth',12:'Waco',13:'Austin',14:'Abilene',15:'San Angelo',16:'Amarillo',17:'Lubbock',18:'Midland',19:'El Paso',20:'San Antonio'};
  const TILE = {16:[2,1],17:[2,2],9:[3,2],11:[4,2],10:[5,2],8:[6,2],19:[1,3],18:[2,3],14:[3,3],12:[4,3],7:[6,3],15:[2,4],13:[4,4],6:[5,4],5:[6,4],20:[3,5],3:[4,5],4:[5,5],2:[4,6],1:[3,7]};
  const YEARS = [2016,2017,2018,2019,2020,2021,2022,2023,2024,2025];
  const FY = YEARS.map(y => 'FY' + String(y).slice(2));
  const BANDS = ['Under 1k','1k–5k','5k–10k','10k–25k','25k+'];
  const LOCALES = ['Urban','Suburban','Town','Rural'];
  const NAMES = [
    ['Brazos Crossing ISD','Brazos',6],['Cedar Ridge ISD','Dallas',10],['Pecan Valley ISD','Comal',13],['Live Oak Prairie ISD','Bexar',20],
    ['Red Mesa ISD','Ector',18],['Caprock Plains ISD','Lubbock',17],['Lone Star Hills CISD','Collin',10],['Mesquite Flats ISD','Tarrant',11],
    ['San Gabriel ISD','Williamson',13],['Blanco Springs ISD','Hays',13],['Coastal Bend ISD','Nueces',2],['Piney Woods ISD','Angelina',7],
    ['Trinity Bend ISD','Denton',11],['Llano Plains ISD','Tom Green',15],['Frio Canyon ISD','Uvalde',20],['Guadalupe Terrace ISD','Victoria',3],
    ['Sabine Forks ISD','Jefferson',5],['North Prairie ISD','Potter',16],['Rio Vista CISD','Hidalgo',1],['Bluebonnet Meadows ISD','Fort Bend',4],
    ['Palo Alto Mesa ISD','Randall',16],['Nueces Ridge ISD','San Patricio',2],['Colorado Bend ISD','Travis',13],['Hill Country Oaks ISD','Kendall',20],
    ['Big Thicket ISD','Hardin',5],['Cross Timbers ISD','Parker',11],['Iron Bridge ISD','Harris',4],['Stonewall Creek ISD','Montgomery',6],
    ['Wichita Bluffs ISD','Wichita',9],['Taylor Crossing ISD','Taylor',14],['Franklin Ridge ISD','El Paso',19],['Hopkins Lake ISD','Hopkins',8],
    ['Bosque Valley ISD','McLennan',12],['Kilgore Pines ISD','Gregg',7],['Harbor Point ISD','Galveston',4],['Laguna Verde CISD','Cameron',1],
    ['Prairie Wind ISD','Ellis',10],['Eagle Pass Trail ISD','Tarrant',11],['Canyon Lake Hills ISD','Comal',13],['Post Oak ISD','Johnson',11],
    ['Wildflower Academy','Travis',13,'charter'],['Summit Ridge Charter School','Harris',4,'charter'],['Eastfield Leadership Academy','Dallas',10,'charter']
  ];
  const MON = {May:5, Nov:11};

  function rng(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  const median = a => { const v=a.filter(x=>x!=null&&!isNaN(x)).sort((x,y)=>x-y); if(!v.length) return null; const m=v.length>>1; return v.length%2?v[m]:(v[m-1]+v[m])/2; };
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-(isd|cisd)$/,'').replace(/^-|-$/g,'');
  const band = e => e<1000?BANDS[0]:e<5000?BANDS[1]:e<10000?BANDS[2]:e<25000?BANDS[3]:BANDS[4];

  // ---------- formatting ----------
  const $ = v => v==null?'—':'$'+Math.round(v).toLocaleString('en-US');
  const $M = v => v==null?'—':v>=1e9?'$'+(v/1e9).toFixed(2)+'B':v>=1e8?'$'+Math.round(v/1e6)+'M':v>=1e6?'$'+(v/1e6).toFixed(1)+'M':'$'+Math.round(v/1e3)+'K';
  const pct = (v,d=0) => (v>0?'+':'')+v.toFixed(d)+'%';
  const ord = n => { const s=['th','st','nd','rd'], v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]); };
  const num = v => Math.round(v).toLocaleString('en-US');

  function series(endVal, growth4, seed, flatEarly=0.07){
    const r=rng(seed); const v21=endVal/(1+growth4/100); const out=[];
    for(let i=0;i<10;i++){ let v; if(i<=5) v=v21*(1-flatEarly+flatEarly*i/5)*(1+(r()-.5)*.035); else v=(v21+(endVal-v21)*(i-5)/4)*(1+(r()-.5)*.03); out.push(v); }
    out[5]=v21; out[9]=endVal; return out.map(v=>Math.round(v*10)/10);
  }

  // ---------- generate ----------
  const D = [];
  function add(o){ D.push(o); }
  // Keller ISD, illustrative values
  add({id:'keller',name:'Keller ISD',county:'Tarrant County',region:11,charter:false,enroll:33420,locale:'Suburban',g5:8.4,campuses:42,
    utilPS:null,utilGrowth:22,util26:7.5,utilShareHint:.27,f5126:4.2,contractedGrowth:104,staffGrowth:2.1,capF51Growth:36,insPS:88,pvPS:612000,pvGrowth5:38,
    bonds:[{y:2002,month:'May',amt:98,passed:true,yes:63},{y:2007,month:'May',amt:195,passed:true,yes:58},{y:2011,month:'Nov',amt:124,passed:false,yes:44},{y:2017,month:'May',amt:315,passed:true,yes:61}],
    debt:618000000,retire5:142000000,isRate:.29,moRate:.7575,seed:9001,superName:'On file (AskTED, Aug 2026)'});
  NAMES.forEach(([name,county,region,type],i)=>{
    const r=rng(i*7919+101); const charter=type==='charter';
    const enroll=charter?Math.round(1200+r()*5200):Math.round(Math.exp(Math.log(700)+r()*Math.log(80)));
    const q=r();
    const locale=enroll>30000?(q<.5?'Urban':'Suburban'):enroll>8000?(q<.7?'Suburban':'Urban'):enroll>2500?(q<.6?'Town':'Suburban'):(q<.75?'Rural':'Town');
    const o={id:slug(name),name,county:county+' County',region,charter,enroll,locale,
      g5:+(-8+r()*24).toFixed(1),campuses:Math.max(2,Math.round(enroll/(430+r()*320))),
      utilPS:Math.round(170+r()*190),utilGrowth:+(-2+r()*r()*40).toFixed(1),util26:+(-3+r()*14).toFixed(1),utilShareHint:.2+r()*.1,
      f5126:+(-2+r()*10).toFixed(1),contractedGrowth:Math.round(-10+r()*130),staffGrowth:+(-4+r()*18).toFixed(1),capF51Growth:Math.round(-20+r()*80),
      insPS:Math.round(40+r()*90),pvPS:Math.round(300000+r()*1100000),pvGrowth5:Math.round(5+r()*55),bonds:[],debt:null,retire5:null,isRate:null,moRate:null,seed:i*31+7,
      superName:charter?'CEO on file (AskTED, Aug 2026)':'On file (AskTED, Aug 2026)'};
    if(!charter){
      for(let y=1998;y<=2026;y++){ if(r()<.11){ const passed=r()<.78, month=r()<.5?'May':'Nov'; if(y===2026&&month==='Nov') continue;
        o.bonds.push({y,month,amt:Math.round(enroll*(1500+r()*7500)/1e5)/10,passed,yes:passed?Math.round(52+r()*22):Math.round(36+r()*13)}); } }
      o.debt=Math.round(enroll*(6000+r()*16000)); o.retire5=Math.round(o.debt*(.1+r()*.25));
      o.isRate=Math.round((.08+r()*.42)*1000)/1000; o.moRate=Math.round((.66+r()*.2)*10000)/10000;
    }
    add(o);
  });
  const byId = {}; D.forEach(d=>byId[d.id]=d);

  D.forEach(d=>{
    d.band=band(d.enroll); d.regionName=REGION_NAMES[d.region]; d.cpk=d.campuses/d.enroll*1000;
    d.bonds.forEach(b=>{ b.monthsAgo=(2026-b.y)*12+(9-MON[b.month]); b.margin=2*b.yes-100; b.label=b.month+' '+b.y; });
    const passed=d.bonds.filter(b=>b.passed); d.lastPassed=passed.length?passed[passed.length-1]:null;
    d.lastElection=d.bonds.length?d.bonds[d.bonds.length-1]:null;
    d.ysb=d.charter?null:d.lastPassed?Math.floor(d.lastPassed.monthsAgo/12):29;
  });

  // ---------- peers ----------
  const PEER_CRITERIA = {
    ops:'Enrollment band · locale · ESC region · campus count · campuses per 1,000 students',
    cap:'Enrollment and growth · property value per student · locale · debt burden · I&S rate'
  };
  const baseCache={};
  function defaultPeers(d,set){
    const key=d.id+':'+set; if(baseCache[key]) return baseCache[key];
    const pool=D.filter(x=>x.id!==d.id&&x.charter===d.charter);
    const score=x=> set==='ops'
      ? Math.abs(Math.log(x.enroll/d.enroll))*1.5+(x.locale!==d.locale?.6:0)+(x.region!==d.region?.35:0)+Math.abs(x.cpk-d.cpk)*.3
      : Math.abs(Math.log(x.enroll/d.enroll))*1.2+Math.abs(x.g5-d.g5)/10+Math.abs(Math.log(x.pvPS/d.pvPS))+(x.locale!==d.locale?.5:0)+(d.isRate!=null&&x.isRate!=null?Math.abs(x.isRate-d.isRate)*2:0);
    return baseCache[key]=pool.slice().sort((a,b)=>score(a)-score(b)).slice(0,8).map(x=>x.id);
  }
  function peersFor(d,set,ov){
    const o=(ov&&ov[d.id+':'+set])||{removed:[],added:[]};
    const ids=defaultPeers(d,set).filter(id=>!o.removed.includes(id));
    (o.added||[]).forEach(id=>{ if(!ids.includes(id)&&id!==d.id&&byId[id]) ids.push(id); });
    return ids;
  }

  // finalize Keller utilities relative to its default peers so the story is stable
  const kel=byId.keller;
  { const p=defaultPeers(kel,'ops').map(id=>byId[id]); kel.utilPS=Math.round(median(p.map(x=>x.utilPS))*1.34); }
  // components + series
  D.forEach(d=>{
    d.f51PS=Math.round(d.utilPS/d.utilShareHint);
    const rem=d.f51PS-d.utilPS; const r=rng(d.seed+3);
    const sh={staff:.5+r()*.1,contracted:.15+r()*.06,other:.09,supplies:.1,capital:.07};
    const tot=Object.values(sh).reduce((a,b)=>a+b);
    const c25={}; Object.keys(sh).forEach(k=>c25[k]=rem*sh[k]/tot);
    const g={staff:d.staffGrowth,contracted:d.contractedGrowth,other:6,supplies:5,capital:d.capF51Growth};
    d.comp={utilities:series(d.utilPS,d.utilGrowth,d.seed+11)};
    Object.keys(c25).forEach((k,i)=>d.comp[k]=series(c25[k],g[k],d.seed+20+i,.05));
    d.utilSeries=d.comp.utilities;
    d.f51Series=YEARS.map((_,i)=>Math.round(['utilities','staff','contracted','other','supplies','capital'].reduce((a,k)=>a+d.comp[k][i],0)));
    d.f51PS=d.f51Series[9];
    d.enrollSeries=series(d.enroll,d.g5*.8,d.seed+40,d.g5/100*.25).map(Math.round);
    d.pvSeries=series(d.pvPS,d.pvGrowth5*.8,d.seed+50,d.pvGrowth5/100*.2).map(Math.round);
    const rr=rng(d.seed+60);
    d.taxYears=['2014','2015','2016','2017','2018','2019','2020','2021','2022','2023'];
    if(d.moRate!=null){
      d.moSeries=d.taxYears.map((_,i)=>+(i<5?1.04:i<8?d.moRate+.09:d.moRate+(i===8?.03:0)).toFixed(4));
      d.isSeries=d.taxYears.map((_,i)=>+Math.min(.5,Math.max(.02,d.isRate+(rr()-.5)*.06+(9-i)*.004)).toFixed(3)); d.isSeries[9]=d.isRate;
    }
    if(d.debt!=null){
      const w=[1,1.1,.9,1.2,.8].map(x=>x*(.8+rr()*.4)), ws=w.reduce((a,b)=>a+b); let rem2=d.debt; d.debtProfile=[];
      for(let i=0;i<20;i++){ d.debtProfile.push({y:2026+i,v:rem2}); const pay=i<5?d.retire5*w[i]/ws:(d.debt-d.retire5)/15*(1+(rr()-.5)*.3); rem2=Math.max(0,rem2-pay); }
    }
    // TEA district number, campuses by level, spending by function (illustrative)
    const rf=rng(d.seed+80);
    d.teaId=d.id==='keller'?'220907':(String(Math.max(1,Math.min(254,d.region*12+Math.round(rf()*11)))).padStart(3,'0')+String(900+Math.round(rf()*99)));
    const hs=Math.max(1,Math.round(d.campuses*(.14+rf()*.06))), ms=Math.max(1,Math.round(d.campuses*(.18+rf()*.06)));
    d.levels={elementary:Math.max(1,d.campuses-hs-ms-(d.campuses>12?1:0)),middle:ms,high:hs,other:d.campuses>12?1:0};
    const fnEnd={instruction:Math.round(5600+rf()*1900),transport:Math.round(280+rf()*420),food:Math.round(480+rf()*330),security:Math.round(70+rf()*190),dataproc:Math.round(110+rf()*220),admin:Math.round(1100+rf()*900),capital:Math.round(300+rf()*2600),debtsvc:d.debt!=null?Math.round(d.debt/d.enroll*.08):0};
    const fnG={instruction:12+rf()*14,transport:8+rf()*30,food:6+rf()*20,security:30+rf()*80,dataproc:10+rf()*30,admin:8+rf()*20,capital:-40+rf()*120,debtsvc:rf()*30};
    d.fn={}; Object.keys(fnEnd).forEach((k,i)=>d.fn[k]=series(fnEnd[k],fnG[k],d.seed+90+i,.08).map(Math.round));
    d.fn.plant=d.f51Series;
    d.fn.total=YEARS.map((_,i)=>Object.keys(d.fn).filter(k=>k!=='total').reduce((a,k)=>a+d.fn[k][i],0));
    d.tapr=null;
  });
  const FUNCS=[{k:'instruction',label:'Instruction'},{k:'admin',label:'Administration & other support'},{k:'plant',label:'Plant maintenance & operations'},{k:'food',label:'Food service'},{k:'transport',label:'Transportation'},{k:'dataproc',label:'Data processing'},{k:'security',label:'Security & monitoring'},{k:'capital',label:'Capital outlay'},{k:'debtsvc',label:'Debt service'}];
  function bondSummary(d){ return [5,10,20].map(y=>{ const b=d.bonds.filter(x=>x.monthsAgo<=y*12); const p=b.filter(x=>x.passed); return {window:'Last '+y+' years',passed:p.length,failed:b.length-p.length,rate:b.length?Math.round(p.length/b.length*100)+'%':'No elections',amount:p.reduce((a,x)=>a+x.amt*1e6,0)}; }); }

  const nonCharter=D.filter(d=>!d.charter);
  const seriesMedian=(list,key)=>YEARS.map((_,i)=>median(list.map(x=>x[key][i])));
  const STATE={util:median(nonCharter.map(d=>d.utilPS)),f51:median(nonCharter.map(d=>d.f51PS)),utilSeries:seriesMedian(nonCharter,'utilSeries'),f51Series:seriesMedian(nonCharter,'f51Series'),pvSeries:seriesMedian(nonCharter,'pvSeries')};
  function regionStats(reg){
    let list=nonCharter.filter(d=>d.region===reg); if(list.length<3) list=nonCharter.filter(d=>Math.abs(d.region-reg)<=1);
    return {n:list.length,util:median(list.map(d=>d.utilPS)),f51:median(list.map(d=>d.f51PS)),utilSeries:seriesMedian(list,'utilSeries'),f51Series:seriesMedian(list,'f51Series')};
  }

  // ---------- derive ----------
  function derive(d,ov){
    const P=peersFor(d,'ops',ov).map(id=>byId[id]), C=peersFor(d,'cap',ov).map(id=>byId[id]);
    const m={n:P.length,nCap:C.length,util:median(P.map(x=>x.utilPS)),utilGrowth:median(P.map(x=>x.utilGrowth)),f51:median(P.map(x=>x.f51PS)),
      contracted:median(P.map(x=>x.contractedGrowth)),staff:median(P.map(x=>x.staffGrowth)),cpk:median(P.map(x=>x.cpk)),util26:median(P.map(x=>x.util26)),
      g5:median(C.map(x=>x.g5)),pv:median(C.map(x=>x.pvPS)),isRate:median(C.map(x=>x.isRate)),debtPS:median(C.map(x=>x.debt!=null?x.debt/x.enroll:null)),
      ysb:median(C.map(x=>x.ysb)),retireShare:median(C.map(x=>x.debt?x.retire5/x.debt:null)),
      fnEnd:(()=>{ const o={}; FUNCS.concat([{k:'total'}]).forEach(f=>o[f.k]=median(P.map(x=>x.fn[f.k][9]))); return o; })(),totalSeries:P.length?YEARS.map((_,i)=>median(P.map(x=>x.fn.total[i]))):null,enrollIdx:P.length?YEARS.map((_,i)=>median(P.map(x=>x.enrollSeries[i]/x.enrollSeries[0]*100))):null,
      utilSeries:P.length?seriesMedian(P,'utilSeries'):null,f51Series:P.length?seriesMedian(P,'f51Series'):null,pvSeries:C.length?seriesMedian(C,'pvSeries'):null,P,C};
    const reg=regionStats(d.region);
    const utilRatio=d.utilPS/m.util-1, f51Ratio=d.f51PS/m.f51-1;
    const S={pc:[],om:[],cap:[]};
    S.pc.push({k:'util-level',fires:utilRatio>=.12,chip:'Utilities '+pct(utilRatio*100)+' vs peers',val:pct(utilRatio*100)});
    S.pc.push({k:'util-growth',fires:d.utilGrowth-m.utilGrowth>=6,chip:'Utilities '+pct(d.utilGrowth)+' since FY21 (peers '+pct(m.utilGrowth)+')',val:pct(d.utilGrowth)});
    S.pc.push({k:'util-budget',fires:d.util26>=5,chip:'FY26 utility budget '+pct(d.util26,1),val:pct(d.util26,1)});
    S.om.push({k:'op-shift',fires:d.contractedGrowth>=50&&d.staffGrowth<6,chip:'Contracted repair '+pct(d.contractedGrowth)+', staff flat',val:pct(d.contractedGrowth)});
    S.om.push({k:'f51-level',fires:f51Ratio>=.1,chip:'Plant M&O '+pct(f51Ratio*100)+' vs peers',val:pct(f51Ratio*100)});
    S.om.push({k:'cap-in-f51',fires:d.capF51Growth>=30,chip:'Capital in Plant M&O '+pct(d.capF51Growth),val:pct(d.capF51Growth)});
    if(!d.charter){
      const le=d.lastElection;
      S.cap.push({k:'cap-timing',fires:d.ysb>=7,chip:d.lastPassed?'No bond passed in '+d.ysb+' yrs':'No passed bond since 1998',val:d.lastPassed?d.ysb+' yrs':'None'});
      S.cap.push({k:'growth',fires:d.g5>=6,chip:'Enrollment '+pct(d.g5,1)+' (5 yr)',val:pct(d.g5,1)});
      S.cap.push({k:'retire',fires:d.retire5/d.debt>=.2,chip:$M(d.retire5)+' principal retires by FY31',val:$M(d.retire5)});
      S.cap.push({k:'capacity',fires:d.isRate<=.30,chip:'I&S rate $'+d.isRate.toFixed(2)+' of $0.50 cap',val:'$'+d.isRate.toFixed(2)});
      S.cap.push({k:'failed',fires:!!(le&&!le.passed&&le.monthsAgo<=36),chip:le?'Bond failed '+le.label:'',val:le&&!le.passed?le.label:'—'});
    }
    const lens={};
    const pctile=(val,list)=>{ const v=list.filter(x=>x!=null); if(!v.length||val==null) return null; return Math.round(v.filter(x=>x<val).length/v.length*100); };
    const le=d.lastElection;
    lens.pc={mag:d.utilPS*d.enroll,magLabel:$M(d.utilPS*d.enroll)+'/yr',magSub:'annual utilities',headline:d.utilPS,spark:d.utilSeries,
      pctile:pctile(d.utilPS,P.map(x=>x.utilPS)),timing:'FY26 utility budget '+pct(d.util26,1)};
    lens.om={mag:d.f51PS*d.enroll,magLabel:$M(d.f51PS*d.enroll)+'/yr',magSub:'plant M&O',headline:d.f51PS,spark:d.f51Series,
      pctile:pctile(d.f51PS,P.map(x=>x.f51PS)),timing:'FY26 Plant M&O budget '+pct(d.f5126,1)};
    lens.cap=d.charter?{mag:0,magLabel:'Not available',magSub:'charter: no debt data',headline:null,spark:d.enrollSeries,pctile:null,timing:'Debt data not available for charter schools',missing:true}
      :{mag:d.retire5,magLabel:$M(d.retire5),magSub:'retiring by FY31',headline:d.retire5,spark:d.enrollSeries,pctile:pctile(d.retire5/d.enroll,C.map(x=>x.debt?x.retire5/x.enroll:null)),
        timing:le&&le.monthsAgo<=12?'Bond '+(le.passed?'passed':'failed')+' '+le.monthsAgo+' mo ago':d.lastPassed?'Last passed bond '+d.lastPassed.label:'No passed bond on record'};
    Object.keys(S).forEach(k=>{ const n=S[k].filter(s=>s.fires).length; lens[k].count=n; lens[k].evidence=n>=3?'Strong':n===2?'Moderate':n===1?'Limited':'None'; });
    return {d,m,reg,S,lens,utilRatio,f51Ratio};
  }

  // ---------- hypothesis cards ----------
  const CAVEAT_NOTE='Per-student figures; district square footage isn’t publicly available.';
  function cards(x){
    const {d,m,S}=x; const f=k=>{ for(const l in S){ const s=S[l].find(s=>s.k===k); if(s) return s.fires; } return false; };
    const out=[]; const vs='vs '+m.n+' similar districts', vsc='vs '+m.nCap+' similar districts';
    const c=(o)=>out.push(Object.assign({id:d.id+':'+o.key,district:d.id},o));
    if(f('util-level')||f('util-growth')){
      const both=f('util-level')&&f('util-growth'); const r=Math.round(x.utilRatio*100);
      c({key:'utility-pressure',lens:'pc',title:'Utility-cost pressure',strength:both?'Strong':'Moderate',dollars:Math.max(0,(d.utilPS-m.util)*d.enroll),dollarsLabel:$M(Math.max(0,(d.utilPS-m.util)*d.enroll))+'/yr above peer median',period:'FY2021–FY2025',group:vs,peerSet:'ops',fresh:'PEIMS actuals FY2025',chart:'util',
        keyNum:pct(r),keyLabel:'utilities per student vs peer median',
        text:'Utility spending is '+Math.abs(r)+'% '+(r>=0?'above':'below')+' the median for similar districts and has '+(d.utilGrowth>=0?'increased ':'decreased ')+Math.abs(d.utilGrowth)+'% since FY2021, compared with '+m.utilGrowth.toFixed(0)+'% for peers.',
        caveat:'May reflect equipment age, controls, rate structure, schedules or added square footage.',
        ask:'What’s driven the utility increase since 2021, and have you had an energy audit recently?'});
    }
    if(f('util-budget')){
      const a=d.utilPS*d.enroll;
      c({key:'utility-budget',lens:'pc',title:'Utility budget growth',strength:d.util26>=8?'Moderate':'Weak',dollars:a*d.util26/100,dollarsLabel:$M(a*d.util26/100)+' planned increase',period:'FY2025 actual → FY2026 budget',group:'District trend',peerSet:'ops',fresh:'PEIMS budget FY2026',chart:'util',
        keyNum:pct(d.util26,1),keyLabel:'FY2026 utility budget vs FY2025 actual',
        text:'The FY2026 adopted budget plans '+d.util26.toFixed(1)+'% more for utilities than FY2025 actual spending ('+$M(a*(1+d.util26/100))+' vs '+$M(a)+').',
        caveat:'Budgets often carry rate assumptions or new campuses coming online.',
        ask:'Does the FY2026 utility budget reflect rate changes, new buildings or expected usage?'});
    }
    if(f('op-shift')){
      const cg=d.contractedGrowth;
      c({key:'op-shift',lens:'om',title:'Operating-model shift',strength:cg>=90?'Strong':'Moderate',dollars:d.comp.contracted[9]*d.enroll,dollarsLabel:$M(d.comp.contracted[9]*d.enroll)+'/yr contracted repair',period:'FY2021–FY2025',group:vs,peerSet:'ops',fresh:'PEIMS actuals FY2025',chart:'comp',
        keyNum:pct(cg),keyLabel:'contracted maintenance & repair since FY2021',
        text:'Contracted maintenance spending has '+(cg>=95?'doubled':'grown '+cg+'%')+' in four years while facilities payroll has '+(d.staffGrowth<3?'remained flat':'grown '+d.staffGrowth+'%')+'.',
        caveat:'May reflect staffing vacancies, a deliberate outsourcing decision or deferred repairs surfacing.',
        ask:'How are you balancing in-house staff and contracted repair, and is the current mix by design?'});
    }
    if(f('f51-level')){
      const r=Math.round(x.f51Ratio*100);
      c({key:'f51-level',lens:'om',title:'Facilities operating cost level',strength:'Moderate',dollars:(d.f51PS-m.f51)*d.enroll,dollarsLabel:$M((d.f51PS-m.f51)*d.enroll)+'/yr above peer median',period:'FY2025',group:vs,peerSet:'ops',fresh:'PEIMS actuals FY2025',chart:'f51',
        keyNum:pct(r),keyLabel:'plant M&O per student vs peer median',
        text:'Plant maintenance & operations spending is '+r+'% above the median for similar districts, at '+$(d.f51PS)+' per student compared with '+$(m.f51)+'.',
        caveat:'Campus count, building age and square footage all affect this and aren’t in public data.',
        ask:'Which parts of the facilities budget have been hardest to hold steady?'});
    }
    if(f('cap-in-f51')){
      c({key:'cap-in-f51',lens:'om',title:'Patch-and-repair indicator',strength:d.capF51Growth>=50?'Moderate':'Weak',dollars:d.comp.capital[9]*d.enroll,dollarsLabel:$M(d.comp.capital[9]*d.enroll)+'/yr capital in Plant M&O',period:'FY2021–FY2025',group:'District trend',peerSet:'ops',fresh:'PEIMS actuals FY2025',chart:'comp',
        keyNum:pct(d.capF51Growth),keyLabel:'capital purchases charged to plant M&O',
        text:'Capital purchases charged to plant maintenance & operations rose '+d.capF51Growth+'% since FY2021.',
        caveat:'Can indicate component replacements funded from the operating budget rather than bonds.',
        ask:'Which system replacements have you funded from the operating budget in the last few years?'});
    }
    if(!d.charter){
      if(f('cap-timing')&&(f('growth')||f('retire'))){
        const all=f('growth')&&f('retire');
        c({key:'cap-timing',lens:'cap',title:'Capital-planning timing',strength:all?'Strong':'Moderate',dollars:d.retire5,dollarsLabel:$M(d.retire5)+' principal retiring by FY2031',period:'FY2021–FY2031',group:vsc,peerSet:'cap',fresh:'Bond elections through May 2026',chart:'debt',
          keyNum:d.ysb+' yrs',keyLabel:'since last passed bond',
          text:(d.lastPassed?'No bond has passed in '+d.ysb+' years':'No bond has passed since 1998')+', enrollment is '+(d.g5>=0?'up ':'down ')+Math.abs(d.g5)+'%, and '+$M(d.retire5)+' of existing principal retires within five years.',
          caveat:'Timing and capacity signals show when a bond could be feasible, not whether buildings need work.',
          ask:'Is the board considering a facility assessment or long-range plan ahead of a future bond?'});
      } else if(f('retire')){
        c({key:'retire',lens:'cap',title:'Debt capacity freeing up',strength:'Moderate',dollars:d.retire5,dollarsLabel:$M(d.retire5)+' principal retiring by FY2031',period:'FY2026–FY2031',group:vsc,peerSet:'cap',fresh:'TWDB debt FY2025',chart:'debt',
          keyNum:$M(d.retire5),keyLabel:'principal retiring within five years',
          text:$M(d.retire5)+' of existing principal ('+Math.round(d.retire5/d.debt*100)+'% of outstanding debt) retires by FY2031.',
          caveat:'Retiring debt frees capacity; it does not indicate facility need on its own.',
          ask:'How does the board see the debt schedule lining up with future capital needs?'});
      }
      if(f('capacity')){
        c({key:'capacity',lens:'cap',title:'Fiscal capacity',strength:'Moderate',dollars:null,dollarsLabel:'$'+(0.5-d.isRate).toFixed(2)+' I&S headroom',period:'Tax year 2023',group:vsc,peerSet:'cap',fresh:'Comptroller tax rates 2023-24',chart:'is',
          keyNum:'$'+d.isRate.toFixed(2),keyLabel:'I&S tax rate per $100 (cap $0.50)',
          text:'The I&S (debt) tax rate is $'+d.isRate.toFixed(2)+' per $100 of property value, $'+(0.5-d.isRate).toFixed(2)+' below the $0.50 cap, and property value per student is up '+d.pvGrowth5+'% over five years.',
          caveat:'Capacity depends on growth assumptions and existing debt structure; the district’s financial advisor will have the full picture.',
          ask:'How is the board thinking about I&S rate headroom and future capital needs?'});
      }
      if(f('failed')){
        const le=d.lastElection;
        c({key:'failed',lens:'cap',title:'Community support',strength:'Moderate',dollars:le.amt*1e6,dollarsLabel:$M(le.amt*1e6)+' proposition',period:le.label,group:'District history',peerSet:'cap',fresh:'Bond elections through May 2026',chart:'bonds',
          keyNum:le.yes+'%',keyLabel:'voted in favor, '+le.label,
          text:'Voters declined a '+$M(le.amt*1e6)+' proposition in '+le.label+', with '+le.yes+'% voting in favor.',
          caveat:'A failed election is often followed by a revised proposal informed by a facility assessment.',
          ask:'What did you hear from the community after the last election?'});
      }
    }
    return out;
  }

  // ---------- chart builders (h = React.createElement) ----------
  const STY={district:{stroke:'#0082FF',w:2.5},peer:{stroke:'#4A4845',w:1.75,dash:'6 4'},region:{stroke:'#6E6C68',w:1.75,dash:'1.5 3.5'},state:{stroke:'#9C9A95',w:1.5}};
  function niceStep(r){ const e=Math.pow(10,Math.floor(Math.log10(r))); const f=r/e; return (f<1.5?1:f<3?2:f<7?5:10)*e; }
  function ticks(lo,hi,n=4){ const s=niceStep((hi-lo)/n); const out=[]; for(let v=Math.ceil(lo/s)*s; v<=hi+1e-9; v+=s) out.push(+v.toFixed(6)); return out; }
  const T=(h,p,txt)=>h('text',Object.assign({fontFamily:'Inter, sans-serif',fontSize:11,fill:'#6E6C68'},p),txt);

  function lineSvg(h,{labels,series,fmt,w=640,hgt=230,yMin,yMax,refLine,endLabels=true,xEvery=1}){
    const L=52,R=endLabels?118:14,Tp=12,B=26;
    const all=series.flatMap(s=>s.vals.filter(v=>v!=null)).concat(refLine?[refLine.v]:[]);
    let lo=yMin!=null?yMin:Math.min(...all), hi=yMax!=null?yMax:Math.max(...all); const pad=(hi-lo)*.12||1; if(yMin==null) lo-=pad; if(yMax==null) hi+=pad;
    const X=i=>L+(w-L-R)*i/(labels.length-1), Y=v=>Tp+(hgt-Tp-B)*(1-(v-lo)/(hi-lo));
    const k=[]; ticks(lo,hi).forEach((t,i)=>{ k.push(h('line',{key:'g'+i,x1:L,x2:w-R+6,y1:Y(t),y2:Y(t),stroke:'#EFEEEC'})); k.push(T(h,{key:'t'+i,x:L-8,y:Y(t)+4,textAnchor:'end'},fmt(t))); });
    labels.forEach((l,i)=>{ if(i%xEvery===0||i===labels.length-1) k.push(T(h,{key:'x'+i,x:X(i),y:hgt-6,textAnchor:'middle'},l)); });
    if(refLine){ k.push(h('line',{key:'ref',x1:L,x2:w-R+6,y1:Y(refLine.v),y2:Y(refLine.v),stroke:'#161514',strokeDasharray:'2 3'})); k.push(T(h,{key:'reft',x:w-R+10,y:Y(refLine.v)+4,fill:'#161514'},refLine.label)); }
    const ends=[];
    series.slice().reverse().forEach((s,si)=>{ const st=STY[s.kind]||STY.district; let d=''; s.vals.forEach((v,i)=>{ if(v==null) return; d+=(d?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1); });
      k.push(h('path',{key:'p'+si,d,fill:'none',stroke:st.stroke,strokeWidth:st.w,strokeDasharray:st.dash,strokeLinecap:'round',strokeLinejoin:'round'}));
      const lv=s.vals[s.vals.length-1]; if(lv!=null){ if(s.kind==='district') k.push(h('circle',{key:'c'+si,cx:X(s.vals.length-1),cy:Y(lv),r:3.5,fill:st.stroke})); ends.push({y:Y(lv),label:s.label+' '+fmt(lv),color:s.kind==='district'?'#004E99':'#4A4845',bold:s.kind==='district'}); } });
    if(endLabels){ ends.sort((a,b)=>a.y-b.y); for(let i=1;i<ends.length;i++) if(ends[i].y-ends[i-1].y<13) ends[i].y=ends[i-1].y+13;
      ends.forEach((e,i)=>k.push(T(h,{key:'e'+i,x:w-R+10,y:e.y+4,fill:e.color,fontWeight:e.bold?600:400},e.label))); }
    return h('svg',{viewBox:'0 0 '+w+' '+hgt,style:{width:'100%',height:'auto',display:'block',overflow:'visible'},role:'img'},k);
  }
  function barsSvg(h,{labels,vals,fmt,w=640,hgt=220,hi,xEvery=1,color='#0082FF',muted='#C9C7C2',highlight}){
    const L=52,R=14,Tp=12,B=26; const mx=Math.max(...vals)*1.08||1;
    const bw=(w-L-R)/vals.length; const Y=v=>Tp+(hgt-Tp-B)*(1-v/mx); const k=[];
    ticks(0,mx).forEach((t,i)=>{ k.push(h('line',{key:'g'+i,x1:L,x2:w-R,y1:Y(t),y2:Y(t),stroke:'#EFEEEC'})); k.push(T(h,{key:'t'+i,x:L-8,y:Y(t)+4,textAnchor:'end'},fmt(t))); });
    vals.forEach((v,i)=>{ const on=highlight?highlight(i):true; k.push(h('rect',{key:'b'+i,x:L+i*bw+bw*.15,y:Y(v),width:bw*.7,height:Math.max(0,Y(0)-Y(v)),fill:on?color:muted}));
      if(i%xEvery===0) k.push(T(h,{key:'x'+i,x:L+i*bw+bw/2,y:hgt-6,textAnchor:'middle'},labels[i])); });
    return h('svg',{viewBox:'0 0 '+w+' '+hgt,style:{width:'100%',height:'auto',display:'block'},role:'img'},k);
  }
  function yoySvg(h,{labels,vals,w=640,hgt=170}){
    const L=52,R=14,Tp=10,B=26; const mx=Math.max(8,...vals.map(Math.abs))*1.15; const bw=(w-L-R)/vals.length;
    const Y=v=>Tp+(hgt-Tp-B)*(1-(v+mx)/(2*mx)); const k=[];
    [-mx*.8,0,mx*.8].map(v=>Math.round(v)).forEach((t,i)=>{ k.push(h('line',{key:'g'+i,x1:L,x2:w-R,y1:Y(t),y2:Y(t),stroke:t===0?'#9C9A95':'#EFEEEC'})); k.push(T(h,{key:'t'+i,x:L-8,y:Y(t)+4,textAnchor:'end'},(t>0?'+':'')+t+'%')); });
    vals.forEach((v,i)=>{ if(v==null) return; const big=Math.abs(v)>=8; k.push(h('rect',{key:'b'+i,x:L+i*bw+bw*.2,y:Math.min(Y(v),Y(0)),width:bw*.6,height:Math.abs(Y(v)-Y(0)),fill:big?'#0082FF':'#B8DBFF'}));
      k.push(T(h,{key:'v'+i,x:L+i*bw+bw/2,y:v>=0?Y(v)-4:Y(v)+12,textAnchor:'middle',fill:'#2D2C2A',fontSize:10},(v>0?'+':'')+v.toFixed(0)+'%'));
      k.push(T(h,{key:'x'+i,x:L+i*bw+bw/2,y:hgt-6,textAnchor:'middle'},labels[i])); });
    return h('svg',{viewBox:'0 0 '+w+' '+hgt,style:{width:'100%',height:'auto',display:'block'},role:'img'},k);
  }
  function hbarSvg(h,{items,fmt,w=640}){
    const L=210,R=70,row=28,Tp=6; const hgt=Tp+items.length*row+4; const mx=Math.max(...items.map(i=>Math.max(i.v,i.peer||0)))*1.05||1; const X=v=>L+(w-L-R)*v/mx; const k=[];
    items.forEach((it,i)=>{ const y=Tp+i*row;
      k.push(T(h,{key:'l'+i,x:L-10,y:y+15,textAnchor:'end',fill:'#2D2C2A',fontSize:11.5},it.label));
      k.push(h('rect',{key:'b'+i,x:L,y:y+4,width:Math.max(1,X(it.v)-L),height:15,fill:it.hi?'#0082FF':'#8AC3FF'}));
      if(it.peer!=null) k.push(h('line',{key:'p'+i,x1:X(it.peer),x2:X(it.peer),y1:y,y2:y+23,stroke:'#161514',strokeWidth:2}));
      k.push(T(h,{key:'v'+i,x:Math.max(X(it.v),it.peer!=null?X(it.peer):0)+8,y:y+15,fill:'#161514',fontWeight:600,fontSize:11},fmt(it.v)));
    });
    return h('svg',{viewBox:'0 0 '+w+' '+hgt,style:{width:'100%',height:'auto',display:'block'},role:'img'},k);
  }
  const COMP=[{k:'staff',label:'In-house staff',color:'#2D2C2A'},{k:'contracted',label:'Contracted maintenance & repair',color:'#004E99'},{k:'other',label:'Other contracted services',color:'#8AC3FF'},{k:'utilities',label:'Utilities',color:'#0082FF'},{k:'supplies',label:'Supplies',color:'#C9C7C2'},{k:'capital',label:'Capital charged to Plant M&O',color:'#6E6C68'}];
  function stackSvg(h,{d,w=640,hgt=240,xEvery=1}){
    const L=40,R=14,Tp=8,B=26; const bw=(w-L-R)/YEARS.length; const k=[];
    [0,25,50,75,100].forEach((t,i)=>{ const y=Tp+(hgt-Tp-B)*(1-t/100); k.push(T(h,{key:'t'+i,x:L-8,y:y+4,textAnchor:'end'},t+'%')); });
    YEARS.forEach((_,i)=>{ const tot=COMP.reduce((a,c)=>a+d.comp[c.k][i],0); let acc=0;
      COMP.forEach((c,j)=>{ const v=d.comp[c.k][i]/tot; const y0=Tp+(hgt-Tp-B)*(1-acc-v); k.push(h('rect',{key:i+'-'+j,x:L+i*bw+bw*.1,y:y0,width:bw*.8,height:(hgt-Tp-B)*v,fill:c.color,stroke:'#fff',strokeWidth:.75})); acc+=v; });
      if(i%xEvery===0||i===YEARS.length-1) k.push(T(h,{key:'x'+i,x:L+i*bw+bw/2,y:hgt-6,textAnchor:'middle'},FY[i])); });
    return h('svg',{viewBox:'0 0 '+w+' '+hgt,style:{width:'100%',height:'auto',display:'block'},role:'img'},k);
  }
  function timelineSvg(h,{d,w=640,hgt=170}){
    const L=20,R=20,from=1998,to=2027; const X=y=>L+(w-L-R)*(y-from)/(to-from); const mid=86; const k=[];
    k.push(h('line',{key:'axis',x1:L,x2:w-R,y1:mid,y2:mid,stroke:'#C9C7C2'}));
    for(let y=2000;y<=2026;y+=2){ k.push(h('line',{key:'tk'+y,x1:X(y),x2:X(y),y1:mid-3,y2:mid+3,stroke:'#C9C7C2'})); if(y%4===0) k.push(T(h,{key:'ty'+y,x:X(y),y:hgt-6,textAnchor:'middle'},String(y))); }
    const mx=Math.max(50,...d.bonds.map(b=>b.amt));
    d.bonds.forEach((b,i)=>{ const x=X(b.y+(b.month==='Nov'?.85:.4)); const r=5+Math.sqrt(b.amt/mx)*22; const cy=b.passed?mid-r-4:mid+r+4;
      k.push(h('g',{key:'b'+i},[
        h('title',{key:'tt'},b.label+': '+$M(b.amt*1e6)+', '+(b.passed?'passed':'failed')+', '+b.yes+'% in favor ('+(b.margin>0?'+':'')+b.margin+' pts)'),
        h('line',{key:'l',x1:x,x2:x,y1:mid,y2:cy,stroke:'#C9C7C2'}),
        h('circle',{key:'c',cx:x,cy,r,fill:b.passed?'#0082FF':'#fff',stroke:b.passed?'#0082FF':'#161514',strokeWidth:1.5}),
        b.passed?h('path',{key:'i',d:`M${x-3.5} ${cy}l2.5 2.5 5-5`,stroke:'#fff',strokeWidth:1.75,fill:'none'}):h('path',{key:'i',d:`M${x-3} ${cy-3}l6 6M${x+3} ${cy-3}l-6 6`,stroke:'#161514',strokeWidth:1.5}),
        T(h,{key:'a',x:x,y:b.passed?cy-r-5:cy+r+13,textAnchor:'middle',fill:'#2D2C2A',fontSize:10.5,fontWeight:600},$M(b.amt*1e6))
      ])); });
    k.push(T(h,{key:'lp',x:L,y:14,fill:'#2D2C2A',fontWeight:600},'Passed ▲'));
    k.push(T(h,{key:'lf',x:L,y:hgt-22,fill:'#2D2C2A',fontWeight:600},'Failed ▼'));
    return h('svg',{viewBox:'0 0 '+w+' '+hgt,style:{width:'100%',height:'auto',display:'block',overflow:'visible'},role:'img'},k);
  }
  function spark(h,vals,{w=84,hgt=24,color='#0082FF'}={}){
    const v=vals.filter(x=>x!=null); const lo=Math.min(...v), hi=Math.max(...v)||1; const X=i=>2+(w-4)*i/(vals.length-1), Y=x=>2+(hgt-4)*(1-(x-lo)/((hi-lo)||1));
    let d=''; vals.forEach((x,i)=>{ if(x!=null) d+=(d?'L':'M')+X(i).toFixed(1)+' '+Y(x).toFixed(1); });
    return h('svg',{width:w,height:hgt,viewBox:'0 0 '+w+' '+hgt,style:{display:'block'},'aria-hidden':true},[h('path',{key:'p',d,fill:'none',stroke:color,strokeWidth:1.5}),h('circle',{key:'c',cx:X(vals.length-1),cy:Y(vals[vals.length-1]),r:2,fill:color})]);
  }

  // ---------- chart definitions ----------
  const LEG={district:(n)=>({label:n,color:'#0082FF',style:'solid',w:'3px'}),peer:{label:'Peer median',color:'#4A4845',style:'dashed',w:'2px'},region:{label:'ESC region median',color:'#6E6C68',style:'dotted',w:'2px'},state:{label:'Statewide median',color:'#9C9A95',style:'solid',w:'2px'}};
  function charts(x,h,opt={}){
    const {d,m,reg}=x; const short=d.name.replace(/ (ISD|CISD)$/,'');
    const out={}; const xe=opt.compact?3:1;
    const ug=d.utilGrowth, pg=m.utilGrowth;
    out.util={id:'util',title:'Utility spending per student has grown '+(ug>pg+2?'faster than':ug<pg-2?'slower than':'in line with')+' peers since FY2021',def:'Utilities per student (electricity, gas, water, wastewater and telephone combined), nominal $',
      fresh:'PEIMS actuals FY2025',source:'TEA PEIMS Financial Actual Reports, Function 51 object detail. Retrieved Sep 2026.',peerDef:'Peers: '+m.n+' districts matched on '+PEER_CRITERIA.ops.toLowerCase()+'.',caveat:CAVEAT_NOTE,
      svg:lineSvg(h,{labels:FY,series:[{kind:'state',label:'State',vals:STATE.utilSeries},{kind:'region',label:'Region',vals:reg.utilSeries},{kind:'peer',label:'Peers',vals:m.utilSeries},{kind:'district',label:short,vals:d.utilSeries}],fmt:v=>'$'+Math.round(v),xEvery:xe,w:opt.w||640,hgt:opt.hgt||230}),
      legend:[LEG.district(d.name),LEG.peer,LEG.region,LEG.state],
      head:['Fiscal year',d.name,'Peer median','Region median','State median'],rows:FY.map((f,i)=>[f,$(d.utilSeries[i]),$(m.utilSeries[i]),$(reg.utilSeries[i]),$(STATE.utilSeries[i])])};
    const cg=d.contractedGrowth;
    out.comp={id:'comp',title:cg>=50?'Contracted repair has taken a larger share of plant M&O since FY2021':'Plant M&O spending mix, FY2016–FY2025',def:'Share of plant maintenance & operations (Function 51) spending by component, excluding property insurance',
      fresh:'PEIMS actuals FY2025',source:'TEA PEIMS Financial Actual Reports, Function 51 by object code. Retrieved Sep 2026.',peerDef:'District only; no peer comparison.',caveat:'Insurance ($'+d.insPS+'/student) is excluded: premiums are market-driven, not a facilities-management signal.',
      svg:stackSvg(h,{d,xEvery:xe,w:opt.w||640,hgt:opt.hgt||240}),legend:COMP.map(c=>({label:c.label,color:c.color,style:'solid',w:'10px',box:true})),
      head:['Fiscal year'].concat(COMP.map(c=>c.label)),rows:FY.map((f,i)=>{ const tot=COMP.reduce((a,c)=>a+d.comp[c.k][i],0); return [f].concat(COMP.map(c=>Math.round(d.comp[c.k][i]/tot*100)+'%')); })};
    out.f51={id:'f51',title:'Plant M&O per student is '+(x.f51Ratio>=.05?'above':x.f51Ratio<=-.05?'below':'close to')+' the peer median',def:'Plant maintenance & operations (Function 51) per student, nominal $',
      fresh:'PEIMS actuals FY2025',source:'TEA PEIMS Financial Actual Reports. Retrieved Sep 2026.',peerDef:'Peers: '+m.n+' districts matched on '+PEER_CRITERIA.ops.toLowerCase()+'.',caveat:CAVEAT_NOTE,
      svg:lineSvg(h,{labels:FY,series:[{kind:'state',label:'State',vals:STATE.f51Series},{kind:'region',label:'Region',vals:reg.f51Series},{kind:'peer',label:'Peers',vals:m.f51Series},{kind:'district',label:short,vals:d.f51Series}],fmt:v=>'$'+num(v),xEvery:xe,w:opt.w||640,hgt:opt.hgt||230}),
      legend:[LEG.district(d.name),LEG.peer,LEG.region,LEG.state],head:['Fiscal year',d.name,'Peer median','Region median','State median'],rows:FY.map((f,i)=>[f,$(d.f51Series[i]),$(m.f51Series[i]),$(reg.f51Series[i]),$(STATE.f51Series[i])])};
    const yoy=d.utilSeries.map((v,i)=>i?+((v/d.utilSeries[i-1]-1)*100).toFixed(1):null).slice(1);
    out.yoy={id:'yoy',title:'Utility growth has been '+(yoy.filter(v=>v>=4).length>=4?'persistent':'uneven')+' rather than a single spike',def:'Year-over-year change in utilities per student, %',fresh:'PEIMS actuals FY2025',source:'TEA PEIMS Financial Actual Reports. Retrieved Sep 2026.',peerDef:'District only.',caveat:'Darker bars mark changes of 8% or more.',
      svg:yoySvg(h,{labels:FY.slice(1),vals:yoy}),legend:[],head:['Fiscal year','Change'],rows:FY.slice(1).map((f,i)=>[f,(yoy[i]>0?'+':'')+yoy[i]+'%'])};
    const fe=FUNCS.map(f=>({label:f.label,v:d.fn[f.k][9],peer:m.fnEnd[f.k],hi:f.k==='plant'})).filter(i=>i.v>0).sort((a,b)=>b.v-a.v);
    const tot=d.fn.total[9];
    out.mix={id:'mix',title:'Plant M&O is '+Math.round(d.fn.plant[9]/tot*100)+'% of total spending per student',def:'Spending per student by function, FY2025, all funds, nominal $. Black tick = peer median.',
      fresh:'PEIMS actuals FY2025',source:'TEA PEIMS Summarized Financial Actuals, all funds. Retrieved Sep 2026.',peerDef:'Peers: '+m.n+' districts matched on '+PEER_CRITERIA.ops.toLowerCase()+'.',caveat:'Capital outlay and debt service swing year to year with construction timing.',
      svg:hbarSvg(h,{items:fe,fmt:v=>'$'+num(v)}),legend:[{label:d.name,color:'#8AC3FF',style:'solid',w:'10px',box:true},{label:'Plant M&O',color:'#0082FF',style:'solid',w:'10px',box:true},{label:'Peer median',color:'#161514',style:'solid',w:'2px'}],
      head:['Function',d.name+' $/student','Peer median $/student','Share of district total'],rows:fe.map(i=>[i.label,$(i.v),$(i.peer),Math.round(i.v/tot*100)+'%'])};
    out.total={id:'total',title:'Total spending per student has '+(d.fn.total[9]>m.totalSeries[9]*1.05?'run above':d.fn.total[9]<m.totalSeries[9]*.95?'run below':'tracked')+' peers',def:'Total expenditures per student, all funds, nominal $',fresh:'PEIMS actuals FY2025',source:'TEA PEIMS Summarized Financial Actuals. Retrieved Sep 2026.',peerDef:'Peers: '+m.n+' districts matched on '+PEER_CRITERIA.ops.toLowerCase()+'.',caveat:'Includes capital outlay and debt service, which vary with bond timing.',
      svg:lineSvg(h,{labels:FY,series:[{kind:'peer',label:'Peers',vals:m.totalSeries},{kind:'district',label:short,vals:d.fn.total}],fmt:v=>'$'+num(v),xEvery:xe,w:opt.w||640,hgt:opt.hgt||210}),legend:[LEG.district(d.name),LEG.peer],
      head:['Fiscal year',d.name,'Peer median'],rows:FY.map((f,i)=>[f,$(d.fn.total[i]),$(m.totalSeries[i])])};
    const eg=Math.round((d.enrollSeries[9]/d.enrollSeries[0]-1)*100), pgI=Math.round(m.enrollIdx[9]-100);
    out.enroll={id:'enroll',title:'Enrollment has '+(eg>=0?'grown ':'declined ')+Math.abs(eg)+'% since FY2016, compared with '+(pgI>=0?'+':'')+pgI+'% for peers',def:'Fall enrollment, students',fresh:'PEIMS FY2025',source:'TEA PEIMS fall enrollment. Retrieved Sep 2026.',peerDef:'Peer line is the median of each peer’s enrollment indexed to FY2016, applied to this district.',caveat:null,
      svg:lineSvg(h,{labels:FY,series:[{kind:'peer',label:'Peers',vals:m.enrollIdx.map(v=>v/100*d.enrollSeries[0])},{kind:'district',label:short,vals:d.enrollSeries}],fmt:v=>num(v),xEvery:xe,w:opt.w||640,hgt:opt.hgt||210}),legend:[LEG.district(d.name),{label:'Peer median growth',color:'#4A4845',style:'dashed',w:'2px'}],
      head:['Fiscal year','Enrollment'],rows:FY.map((f,i)=>[f,num(d.enrollSeries[i])])};
    if(!d.charter){
      out.bonds={id:'bonds',title:d.lastPassed?'Last passed bond: '+$M(d.lastPassed.amt*1e6)+' in '+d.lastPassed.label:'No passed bond on record since 1998',def:'Bond propositions by election date; mark size shows amount. Hover for vote margin.',
        fresh:'Bond elections through May 2026',source:'Texas Bond Review Board / TEA bond election records, 1998–May 2026. Retrieved Sep 2026.',peerDef:'District only.',caveat:null,
        svg:timelineSvg(h,{d}),legend:[{label:'Passed (filled, above line)',color:'#0082FF',style:'solid',w:'10px',box:true},{label:'Failed (open, below line)',color:'#161514',style:'solid',w:'10px',box:true,hollow:true}],
        head:['Election','Amount','Result','In favor','Margin'],rows:d.bonds.map(b=>[b.label,$M(b.amt*1e6),b.passed?'Passed':'Failed',b.yes+'%',(b.margin>0?'+':'')+b.margin+' pts'])};
      out.debt={id:'debt',title:$M(d.retire5)+' of principal retires by FY2031, freeing debt capacity',def:'Outstanding principal at start of each fiscal year, existing issues only',fresh:'Debt outstanding FY2025',source:'Texas Bond Review Board local debt data, by issue with maturity dates. Retrieved Sep 2026.',peerDef:'District only.',caveat:'Excludes future issuance and refunding.',
        svg:barsSvg(h,{labels:d.debtProfile.map(p=>'FY'+String(p.y).slice(2)),vals:d.debtProfile.map(p=>p.v),fmt:v=>$M(v),xEvery:opt.compact?4:2,highlight:i=>i<=5,w:opt.w||640,hgt:opt.hgt||220}),
        legend:[{label:'Through FY2031',color:'#0082FF',style:'solid',w:'10px',box:true},{label:'FY2032 onward',color:'#C9C7C2',style:'solid',w:'10px',box:true}],
        head:['Fiscal year','Principal outstanding'],rows:d.debtProfile.map(p=>['FY'+p.y,$M(p.v)])};
      out.mo={id:'mo',title:'M&O tax rate has been compressed since 2019',def:'Maintenance & operations tax rate, $ per $100 valuation',fresh:'Comptroller 2023-24',source:'Texas Comptroller school district tax rates. Retrieved Sep 2026.',peerDef:'District only.',caveat:'State compression, not district choice, drove most of the decline.',
        svg:lineSvg(h,{labels:d.taxYears,series:[{kind:'district',label:'M&O',vals:d.moSeries}],fmt:v=>'$'+v.toFixed(2),yMin:.5,yMax:1.1,endLabels:false,hgt:170,xEvery:3}),legend:[],head:['Tax year','M&O rate'],rows:d.taxYears.map((y,i)=>[y,'$'+d.moSeries[i].toFixed(4)])};
      out.is={id:'is',title:'I&S rate sits $'+(0.5-d.isRate).toFixed(2)+' below the $0.50 cap',def:'Interest & sinking (debt service) tax rate, $ per $100 valuation',fresh:'Comptroller 2023-24',source:'Texas Comptroller school district tax rates. Retrieved Sep 2026.',peerDef:'District only.',caveat:'The $0.50 test applies to new debt at issuance.',
        svg:lineSvg(h,{labels:d.taxYears,series:[{kind:'district',label:'I&S',vals:d.isSeries}],fmt:v=>'$'+v.toFixed(2),yMin:0,yMax:.55,refLine:{v:.5,label:'$0.50 cap'},endLabels:false,hgt:170,xEvery:3}),legend:[],head:['Tax year','I&S rate'],rows:d.taxYears.map((y,i)=>[y,'$'+d.isSeries[i].toFixed(3)])};
      out.pv={id:'pv',title:'Property value per student is up '+d.pvGrowth5+'% over five years',def:'Taxable property value per student, nominal $',fresh:'Comptroller tax year 2025',source:'Texas Comptroller Property Value Study. Retrieved Sep 2026.',peerDef:'Peers: '+m.nCap+' districts matched on '+PEER_CRITERIA.cap.toLowerCase()+'.',caveat:null,
        svg:lineSvg(h,{labels:FY,series:[{kind:'peer',label:'Peers',vals:m.pvSeries},{kind:'district',label:short,vals:d.pvSeries}],fmt:v=>'$'+Math.round(v/1000)+'K',xEvery:2,hgt:190}),legend:[LEG.district(d.name),LEG.peer],
        head:['Fiscal year',d.name,'Peer median'],rows:FY.map((f,i)=>[f,$(d.pvSeries[i]),$(m.pvSeries[i])])};
    }
    return out;
  }

  window.TXR={FUNCS,bondSummary,hbarSvg,D,byId,REGION_NAMES,TILE,YEARS,FY,BANDS,LOCALES,STATE,PEER_CRITERIA,COMP,CAVEAT_NOTE,median,$,$M,pct,ord,num,peersFor,defaultPeers,derive,cards,charts,spark,lineSvg,barsSvg,regionStats};
})();
