(function () {
  'use strict';
  const core = window.FPU_PORTAL || {};
  const root = document.getElementById('aco-workspace');
  if (!root || root.dataset.bound === '1') return;
  root.dataset.bound = '1';
  const page = root.dataset.page;
  const esc = value => core.escapeHtml ? core.escapeHtml(value == null ? '' : String(value)) : String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = value => value ? new Date(value).toLocaleDateString('en-GB') : '—';
  const money = value => value == null ? '—' : Number(value).toLocaleString('en-NG');
  const configs = {
    sessions:{title:'Academic Sessions',subtitle:'Academic calendar, session dates and current-session status.',endpoint:'/api/academic-officer/sessions',columns:[['name','Session'],['startDate','Start date'],['endDate','End date'],['isCurrent','Current session'],['createdAt','Created']]},
    programmes:{title:'Programmes',subtitle:'Explore programme structure, qualification level, duration and department ownership.',endpoint:'/api/academic-officer/programmes'},
    departments:{title:'Departments',subtitle:'Browse departments by school and explore their student, programme and course records.',endpoint:'/api/academic-officer/departments'},
    courses:{title:'Course Catalogue',subtitle:'Search and filter the full course catalogue by department, programme, level and semester.',endpoint:'/api/academic-officer/courses'},
    results:{title:'Published Results',subtitle:'Review complete published result records and filter by session, department and student level.',endpoint:'/api/academic-officer/results'},
    graduation:{title:'Graduation Pipeline',subtitle:'Track graduation submissions, eligibility summaries, approvals and final graduation status.',endpoint:'/api/academic-officer/graduation'}
  };
  async function request(url){
    if(!core.portalFetch) throw new Error('Portal API client is unavailable. Please sign in again.');
    const response=await core.portalFetch(url);
    if(response&&response.success===false) throw new Error(response.error||'Unable to load records.');
    return response;
  }
  function shell(title,subtitle){
    root.innerHTML=`<style>
      #aco-workspace{color:#172033}
      #aco-workspace .aco-summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.7rem;margin:0 0 1rem}
      #aco-workspace .aco-summary-card{background:#fff;border:1px solid #e5e7eb;border-radius:13px;padding:.9rem;box-shadow:0 2px 8px rgba(15,23,42,.035)}
      #aco-workspace .aco-summary-card span{display:block;color:#64748b;font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
      #aco-workspace .aco-summary-card strong{display:block;color:#064e3b;font-size:1.5rem;line-height:1.25;margin:.2rem 0}
      #aco-workspace .aco-summary-card small{color:#94a3b8;font-size:.68rem}
      #aco-workspace .aco-toolbar select{border:1px solid #dbe2ea;border-radius:8px;padding:.68rem .75rem;background:#fff;color:#334155;font:inherit;min-width:140px}
      #aco-workspace .aco-toolbar input{min-width:210px}
      #aco-workspace .aco-head-actions{display:flex;gap:.5rem;flex-wrap:wrap}
      #aco-workspace .aco-export,#aco-workspace .aco-row-action{border:1px solid #bbf7d0;border-radius:8px;background:#f0fdf4;color:#065f46;padding:.62rem .8rem;font-weight:800;cursor:pointer}
      #aco-workspace .aco-row-action{padding:.4rem .65rem;font-size:.72rem}
      #aco-workspace .aco-export:hover,#aco-workspace .aco-row-action:hover{background:#dcfce7}
      #aco-workspace .aco-modal[hidden]{display:none}
      #aco-workspace .aco-modal{position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.58);display:grid;place-items:center;padding:1rem}
      #aco-workspace .aco-modal-card{width:min(760px,100%);max-height:88vh;overflow:auto;background:#fff;border-radius:16px;box-shadow:0 25px 70px rgba(0,0,0,.25)}
      #aco-workspace .aco-modal-head{display:flex;justify-content:space-between;align-items:center;padding:1rem 1.2rem;border-bottom:1px solid #e5e7eb}
      #aco-workspace .aco-modal-head h3{margin:.2rem 0 0;color:#0f172a}
      #aco-workspace .aco-modal-close{border:0;background:#f1f5f9;border-radius:50%;width:36px;height:36px;font-size:1.4rem;cursor:pointer}
      #aco-workspace .aco-modal-body{padding:1.2rem}
      #aco-workspace .aco-detail-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.7rem}
      #aco-workspace .aco-detail-field{padding:.7rem;background:#f8fafc;border:1px solid #eef2f7;border-radius:9px;min-width:0}
      #aco-workspace .aco-detail-field small{display:block;color:#64748b;font-size:.66rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em}
      #aco-workspace .aco-detail-field strong{display:block;color:#0f172a;font-size:.82rem;margin-top:.2rem;overflow-wrap:anywhere}
      #aco-workspace .aco-transcript-profile{display:flex;align-items:center;gap:.8rem;margin-bottom:1rem;padding:1rem;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px}
      #aco-workspace .aco-transcript-profile h3{margin:0;color:#064e3b}
      #aco-workspace .aco-transcript-profile p{margin:.2rem 0 0;color:#64748b;font-size:.8rem}
      #aco-workspace .aco-transcript-avatar{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:#065f46;color:#fff;font-weight:900}
      #aco-workspace .aco-transcript-actions{display:flex;gap:.5rem;flex-wrap:wrap;margin:1rem 0}
      #aco-workspace .aco-report-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;padding:1rem}
      @media(max-width:640px){#aco-workspace .aco-toolbar input{width:100%;min-width:0}#aco-workspace .aco-toolbar select{flex:1;min-width:130px}#aco-workspace .aco-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media print{body *{visibility:hidden!important}#aco-workspace,#aco-workspace *{visibility:visible!important}#aco-workspace{position:absolute;left:0;top:0;width:100%}#aco-workspace .aco-page-head button,#aco-workspace .aco-toolbar,#aco-workspace .aco-modal{display:none!important}#aco-workspace .aco-panel{border:0}#aco-workspace .aco-table{min-width:0}#aco-workspace .aco-table th,#aco-workspace .aco-table td{font-size:8pt;padding:5px}}
    </style><section class="aco-page-head"><div><span class="aco-eyebrow">ACADEMIC OFFICE</span><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div><div class="aco-head-actions"><button class="aco-refresh" type="button" id="aco-refresh">↻ Refresh</button></div></section><div id="aco-summary" class="aco-summary-grid"></div><section class="aco-panel"><div class="aco-toolbar" id="aco-toolbar"><input id="aco-search" type="search" placeholder="Search records…" aria-label="Search records"><span id="aco-count" class="aco-count">Loading records…</span></div><div class="aco-table-wrap"><table class="aco-table"><thead id="aco-head"></thead><tbody id="aco-body"><tr><td class="aco-empty">Loading records…</td></tr></tbody></table></div></section><div id="aco-detail-modal" class="aco-modal" hidden><div class="aco-modal-card" role="dialog" aria-modal="true" aria-labelledby="aco-modal-title"><div class="aco-modal-head"><div><span class="aco-eyebrow">RECORD DETAILS</span><h3 id="aco-modal-title">Details</h3></div><button type="button" class="aco-modal-close" id="aco-modal-close" aria-label="Close">×</button></div><div id="aco-modal-body" class="aco-modal-body"></div></div></div>`;
    document.getElementById('aco-refresh').addEventListener('click',()=>loadPage(true));
    document.getElementById('aco-modal-close').addEventListener('click',closeModal);
    document.getElementById('aco-detail-modal').addEventListener('click',e=>{if(e.target.id==='aco-detail-modal')closeModal()});
  }
  function closeModal(){const m=document.getElementById('aco-detail-modal');if(m)m.hidden=true}
  function detail(title,fields){
    const modal=document.getElementById('aco-detail-modal');if(!modal)return;
    document.getElementById('aco-modal-title').textContent=title;
    document.getElementById('aco-modal-body').innerHTML='<div class="aco-detail-grid">'+fields.map(([k,v])=>'<div class="aco-detail-field"><small>'+esc(k)+'</small><strong>'+esc(v==null||v===''?'Not provided':v)+'</strong></div>').join('')+'</div>';
    modal.hidden=false;
  }
  function exportCsv(rows,columns,name){
    if(!rows.length){core.showToast&&core.showToast('There are no records to export.','warning');return}
    const quote=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
    const csv=[columns.map(c=>quote(c[1])).join(','),...rows.map(r=>columns.map(c=>quote(typeof c[2]==='function'?c[2](r):r[c[0]])).join(','))].join('\r\n');
    const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}));
    const a=document.createElement('a');a.href=url;a.download=name+'.csv';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }
  function addExportButton(rows,cols,name){
    const toolbar=document.getElementById('aco-toolbar');if(!toolbar)return;
    let btn=document.getElementById('aco-export');
    if(!btn){btn=document.createElement('button');btn.id='aco-export';btn.className='aco-export';btn.type='button';btn.textContent='↓ Export CSV';toolbar.appendChild(btn)}
    btn.onclick=()=>exportCsv(rows,cols,name);
  }
  function addFilter(label,id,options){
    const select=document.createElement('select');select.id=id;select.setAttribute('aria-label',label);select.innerHTML='<option value="">All '+esc(label)+'</option>'+options.map(o=>'<option value="'+esc(o.value)+'">'+esc(o.label)+'</option>').join('');
    document.getElementById('aco-toolbar').appendChild(select);return select;
  }
  function summaryCards(items){
    const box=document.getElementById('aco-summary');if(!box)return;
    box.innerHTML=items.map(x=>'<article class="aco-summary-card"><span>'+esc(x.label)+'</span><strong>'+esc(x.value)+'</strong><small>'+esc(x.note||'Academic records')+'</small></article>').join('');
  }
  function renderTable(columns,rows,options={}){
    const head=document.getElementById('aco-head'),body=document.getElementById('aco-body'),count=document.getElementById('aco-count');
    head.innerHTML='<tr>'+columns.map(c=>'<th>'+esc(c[1])+'</th>').join('')+(options.action?'<th>Action</th>':'')+'</tr>';
    count.textContent=rows.length+' records';
    body.innerHTML=rows.length?rows.map((r,i)=>'<tr data-row="'+i+'">'+columns.map(c=>'<td>'+esc(typeof c[2]==='function'?c[2](r):r[c[0]]??'—')+'</td>').join('')+(options.action?'<td><button type="button" class="aco-row-action" data-detail="'+i+'">View details</button></td>':'')+'</tr>').join(''):'<tr><td colspan="'+(columns.length+(options.action?1:0))+'" class="aco-empty">No matching records found.</td></tr>';
    if(options.onDetail)body.querySelectorAll('[data-detail]').forEach(b=>b.addEventListener('click',()=>options.onDetail(rows[Number(b.dataset.detail)])));
  }
  function optionList(rows,key,labelKey){
    const map=new Map();rows.forEach(r=>{if(r[key]!=null&&r[key]!=='')map.set(String(r[key]),r[labelKey]||String(r[key]))});
    return [...map].map(([value,label])=>({value,label}));
  }
  let cachedRows=[];
  async function loadPage(force){
    const cfg=configs[page];if(!cfg)return;
    const body=document.getElementById('aco-body');if(body)body.innerHTML='<tr><td class="aco-empty">Loading records…</td></tr>';
    try{
      const result=await request(cfg.endpoint+(page==='results'?'?limit=1000':''));
      cachedRows=Array.isArray(result.data)?result.data:[];
      if(page==='sessions')renderSessions(cachedRows);
      if(page==='programmes')renderProgrammes(cachedRows);
      if(page==='departments')renderDepartments(cachedRows);
      if(page==='courses')renderCourses(cachedRows);
      if(page==='results')renderResults(cachedRows);
      if(page==='graduation')renderGraduations(cachedRows);
    }catch(error){
      const b=document.getElementById('aco-body');if(b)b.innerHTML='<tr><td class="aco-empty error">'+esc(error.message)+'</td></tr>';
      const c=document.getElementById('aco-count');if(c)c.textContent='Could not load records';
      core.showToast&&core.showToast(error.message,'error');
    }
  }
  function renderSessions(rows){
    const cols=[['name','Academic session'],['startDate','Start date',r=>date(r.startDate)],['endDate','End date',r=>date(r.endDate)],['isCurrent','Status',r=>r.isCurrent?'Current session':'Previous / upcoming'],['createdAt','Date created',r=>date(r.createdAt)]];
    const current=rows.filter(r=>r.isCurrent).length;
    summaryCards([{label:'Total sessions',value:rows.length},{label:'Current session',value:current},{label:'Other sessions',value:rows.length-current}]);
    const search=document.getElementById('aco-search');search.addEventListener('input',render);
    function render(){const q=search.value.toLowerCase();const filtered=rows.filter(r=>[r.name,r.startDate,r.endDate,r.isCurrent?'current':'previous'].join(' ').toLowerCase().includes(q));renderTable(cols,filtered,{action:true,onDetail:r=>detail(r.name,[['Session',r.name],['Start date',date(r.startDate)],['End date',date(r.endDate)],['Current session',r.isCurrent?'Yes':'No'],['Created',date(r.createdAt)]])});addExportButton(filtered,cols,'academic-sessions')}
    render();
  }
  function renderProgrammes(rows){
    const cols=[['code','Code'],['name','Programme'],['level','Qualification'],['departmentName','Department'],['durationYears','Duration (years)',r=>r.durationYears+' years'],['createdAt','Created',r=>date(r.createdAt)]];
    summaryCards([{label:'Programmes',value:rows.length},{label:'ND programmes',value:rows.filter(r=>r.level==='ND').length},{label:'HND programmes',value:rows.filter(r=>r.level==='HND').length},{label:'Certificate programmes',value:rows.filter(r=>r.level==='CERT').length}]);
    const dept=addFilter('departments','aco-filter-dept',optionList(rows,'departmentId','departmentName'));
    const level=addFilter('qualification levels','aco-filter-level',optionList(rows,'level','level'));
    const search=document.getElementById('aco-search');
    function render(){const q=search.value.toLowerCase();const filtered=rows.filter(r=>(!dept.value||String(r.departmentId)===dept.value)&&(!level.value||r.level===level.value)&&[r.code,r.name,r.departmentName,r.departmentCode,r.level].join(' ').toLowerCase().includes(q));renderTable(cols,filtered,{action:true,onDetail:r=>detail(r.name,[['Programme code',r.code],['Programme name',r.name],['Qualification level',r.level],['Department',r.departmentName],['Department code',r.departmentCode],['Duration',r.durationYears+' years'],['Record created',date(r.createdAt)]])});addExportButton(filtered,cols,'academic-programmes')}
    [dept,level,search].forEach(x=>x.addEventListener('input',render));render();
  }
  function renderDepartments(rows){
    const cols=[['code','Code'],['name','Department'],['schoolName','School'],['studentCount','Students'],['programmeCount','Programmes'],['courseCount','Courses']];
    summaryCards([{label:'Departments',value:rows.length},{label:'Schools represented',value:new Set(rows.map(r=>r.schoolId)).size},{label:'Students',value:rows.reduce((n,r)=>n+Number(r.studentCount||0),0)},{label:'Courses',value:rows.reduce((n,r)=>n+Number(r.courseCount||0),0)}]);
    const schools=addFilter('schools','aco-filter-school',optionList(rows,'schoolId','schoolName'));
    const search=document.getElementById('aco-search');
    function render(){const q=search.value.toLowerCase();const filtered=rows.filter(r=>(!schools.value||String(r.schoolId)===schools.value)&&[r.code,r.name,r.schoolName].join(' ').toLowerCase().includes(q));renderTable(cols,filtered,{action:true,onDetail:r=>detail(r.name,[['Department code',r.code],['Department',r.name],['School',r.schoolName],['HOD',r.hodName||'Not assigned'],['Students',r.studentCount??0],['Programmes',r.programmeCount??0],['Courses',r.courseCount??0],['Created',date(r.createdAt)]])});addExportButton(filtered,cols,'academic-departments')}
    [schools,search].forEach(x=>x.addEventListener('input',render));render();
  }
  function renderCourses(rows){
    const cols=[['code','Course code'],['title','Course title'],['unit','Units'],['level','Level'],['semesterName','Semester'],['yearOfStudy','Year'],['programmeName','Programme'],['departmentName','Department'],['isElective','Type',r=>r.isElective?'Elective':'Core'],['isActive','Availability',r=>r.isActive?'Active':'Inactive']];
    summaryCards([{label:'Courses',value:rows.length},{label:'Active',value:rows.filter(r=>r.isActive).length},{label:'Inactive',value:rows.filter(r=>!r.isActive).length},{label:'Total credit units',value:rows.reduce((n,r)=>n+Number(r.unit||0),0)}]);
    const dept=addFilter('departments','aco-filter-dept',optionList(rows,'departmentId','departmentName'));
    const level=addFilter('levels','aco-filter-level',optionList(rows,'level','level'));
    const semester=addFilter('semesters','aco-filter-semester',optionList(rows,'semesterName','semesterName'));
    const search=document.getElementById('aco-search');
    function render(){const q=search.value.toLowerCase();const filtered=rows.filter(r=>(!dept.value||String(r.departmentId)===dept.value)&&(!level.value||r.level===level.value)&&(!semester.value||r.semesterName===semester.value)&&[r.code,r.title,r.programmeName,r.departmentName,r.level].join(' ').toLowerCase().includes(q));renderTable(cols,filtered,{action:true,onDetail:r=>detail(r.title,[['Course code',r.code],['Course title',r.title],['Description',r.description||'Not provided'],['Credit units',r.unit],['Level',r.level],['Semester',r.semesterName],['Year of study',r.yearOfStudy],['Programme',r.programmeName],['Department',r.departmentName],['Core / elective',r.isElective?'Elective':'Core'],['Status',r.isActive?'Active':'Inactive']])});addExportButton(filtered,cols,'academic-course-catalogue')}
    [dept,level,semester,search].forEach(x=>x.addEventListener('input',render));render();
  }
  function renderResults(rows){
    const cols=[['studentName','Student'],['studentMatric','Matric number'],['departmentName','Department'],['level','Level'],['sessionName','Session'],['courseCode','Course code'],['courseTitle','Course title'],['score','Score'],['grade','Grade'],['semester','Semester'],['publishedAt','Published',r=>date(r.publishedAt)]];
    summaryCards([{label:'Published results',value:rows.length},{label:'Departments',value:new Set(rows.map(r=>r.departmentName).filter(Boolean)).size},{label:'ND records',value:rows.filter(r=>r.level==='ND').length},{label:'HND records',value:rows.filter(r=>r.level==='HND').length}]);
    const session=addFilter('sessions','aco-filter-session',optionList(rows,'sessionId','sessionName'));
    const dept=addFilter('departments','aco-filter-dept',optionList(rows,'departmentId','departmentName'));
    const level=addFilter('levels','aco-filter-level',optionList(rows,'level','level'));
    const search=document.getElementById('aco-search');
    function render(){const q=search.value.toLowerCase();const filtered=rows.filter(r=>(!session.value||String(r.sessionId)===session.value)&&(!dept.value||String(r.departmentId)===dept.value)&&(!level.value||r.level===level.value)&&[r.studentName,r.studentMatric,r.departmentName,r.sessionName,r.courseCode,r.courseTitle,r.grade,r.semester].join(' ').toLowerCase().includes(q));renderTable(cols,filtered,{action:true,onDetail:r=>detail('Published result · '+(r.studentName||'Student'),[['Student',r.studentName],['Matric number',r.studentMatric],['Department',r.departmentName],['School',r.schoolName],['Programme',r.programmeName],['Student level',r.level],['Session',r.sessionName],['Course code',r.courseCode],['Course title',r.courseTitle],['Course level',r.courseLevel],['Credit units',r.courseUnit],['Semester',r.semester],['Score',r.score],['Grade',r.grade],['Grade points',r.points],['Result status',r.status],['Published date',date(r.publishedAt)]])});addExportButton(filtered,cols,'published-results')}
    [session,dept,level,search].forEach(x=>x.addEventListener('input',render));render();
  }
  function renderGraduations(rows){
    const normalize=r=>{const g=r.graduation||{},s=r.student||{};return {...r,...g,studentName:[s.firstName,s.middleName,s.lastName].filter(Boolean).join(' '),matricNumber:s.matricNumber,departmentName:s.departmentName||r.departmentName,sessionName:r.sessionName,programmeName:r.programmeName,level:g.level||s.level,status:g.status||'pending'}};
    const data=rows.map(normalize);
    const cols=[['studentName','Student'],['matricNumber','Matric number'],['departmentName','Department'],['programmeName','Programme'],['level','Level'],['sessionName','Session'],['cgpa','CGPA'],['classification','Classification'],['status','Status'],['createdAt','Submitted',r=>date(r.createdAt)]];
    summaryCards([{label:'Graduation records',value:data.length},{label:'Pending',value:data.filter(r=>r.status==='pending').length},{label:'Approved',value:data.filter(r=>r.status==='approved').length},{label:'Graduated',value:data.filter(r=>r.status==='graduated').length}]);
    const status=addFilter('statuses','aco-filter-status',optionList(data,'status','status'));
    const dept=addFilter('departments','aco-filter-dept',optionList(data,'departmentId','departmentName'));
    const session=addFilter('sessions','aco-filter-session',optionList(data,'sessionId','sessionName'));
    const search=document.getElementById('aco-search');
    function render(){const q=search.value.toLowerCase();const filtered=data.filter(r=>(!status.value||r.status===status.value)&&(!dept.value||String(r.departmentId)===dept.value)&&(!session.value||String(r.sessionId)===session.value)&&[r.studentName,r.matricNumber,r.departmentName,r.programmeName,r.sessionName,r.status,r.classification].join(' ').toLowerCase().includes(q));renderTable(cols,filtered,{action:true,onDetail:r=>detail('Graduation record · '+r.studentName,[['Student',r.studentName],['Matric number',r.matricNumber],['Department',r.departmentName],['Programme',r.programmeName],['Level',r.level],['Session',r.sessionName],['CGPA',r.cgpa],['Classification',r.classification],['Status',r.status],['Remarks',r.remarks],['Submitted',date(r.createdAt)],['Approved',date(r.approvedAt)]])});addExportButton(filtered,cols,'graduation-pipeline')}
    [status,dept,session,search].forEach(x=>x.addEventListener('input',render));render();
  }
  async function loadTranscripts(){
    shell('Transcript Lookup','Retrieve a complete student academic profile and published transcript using matriculation number or student ID.');
    document.getElementById('aco-toolbar').innerHTML='<form id="aco-transcript-form" class="aco-lookup-form"><label for="aco-student-id">Matric number or student ID</label><input id="aco-student-id" type="text" required placeholder="e.g. FPU/ND/… or student ID"><button class="aco-refresh" type="submit">Search transcript</button></form>';
    document.querySelector('.aco-table-wrap').innerHTML='<div id="aco-transcript-result" class="aco-transcript-result"><p class="aco-empty">Search for a student to view their full academic record.</p></div>';
    const form=document.getElementById('aco-transcript-form'),box=document.getElementById('aco-transcript-result');
    form.addEventListener('submit',async e=>{e.preventDefault();const key=document.getElementById('aco-student-id').value.trim();if(!key)return;box.innerHTML='<p class="aco-empty">Retrieving academic record…</p>';try{
      const result=await request('/api/academic-officer/transcripts?student='+encodeURIComponent(key));
      const s=result.student||{},summary=result.summary||{},rows=Array.isArray(result.rows)?result.rows:[];
      const name=[s.firstName,s.middleName,s.lastName].filter(Boolean).join(' ');
      const fields=[['Full name',name],['Matric number',s.matricNumber],['Student ID',s.id],['Email',s.email],['Phone',s.phone],['Gender',s.gender],['Date of birth',date(s.dateOfBirth)],['State of origin',s.stateOfOrigin],['Nationality',s.nationality],['Address',s.address],['School',s.schoolName],['Department',s.departmentName],['Programme',s.programmeName],['Level',s.level],['CGPA',summary.cgpa],['Classification',summary.classification],['Total courses',rows.length]];
      box.innerHTML='<div class="aco-transcript-profile"><div class="aco-transcript-avatar">'+esc(name.split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase())+'</div><div><h3>'+esc(name||'Student record')+'</h3><p>'+esc(s.matricNumber||'No matric number')+' · '+esc(s.departmentName||'Department not assigned')+'</p></div></div><div class="aco-detail-grid">'+fields.map(([k,v])=>'<div class="aco-detail-field"><small>'+esc(k)+'</small><strong>'+esc(v==null||v===''?'Not provided':v)+'</strong></div>').join('')+'</div><div class="aco-transcript-actions"><button type="button" class="aco-export" id="aco-transcript-print">Print transcript</button><button type="button" class="aco-export" id="aco-transcript-csv">Export course records</button></div><div class="aco-table-wrap"><table class="aco-table"><thead><tr><th>Session</th><th>Semester</th><th>Course code</th><th>Course title</th><th>Units</th><th>Score</th><th>Grade</th><th>Points</th></tr></thead><tbody>'+(rows.length?rows.map(r=>'<tr><td>'+esc(r.sessionName||r.result?.sessionName||'—')+'</td><td>'+esc(r.result?.semester||'—')+'</td><td>'+esc(r.course?.code||'—')+'</td><td>'+esc(r.course?.title||'—')+'</td><td>'+esc(r.course?.unit??'—')+'</td><td>'+esc(r.result?.score??'—')+'</td><td>'+esc(r.result?.grade||'—')+'</td><td>'+esc(r.result?.points??'—')+'</td></tr>').join(''):'<tr><td colspan="8" class="aco-empty">No published transcript records found.</td></tr>')+'</tbody></table></div>';
      document.getElementById('aco-transcript-print').addEventListener('click',()=>window.print());
      document.getElementById('aco-transcript-csv').addEventListener('click',()=>exportCsv(rows.map(r=>({session:r.result?.sessionName,semester:r.result?.semester,code:r.course?.code,title:r.course?.title,unit:r.course?.unit,score:r.result?.score,grade:r.result?.grade,points:r.result?.points})),[['session','Session'],['semester','Semester'],['code','Course code'],['title','Course title'],['unit','Units'],['score','Score'],['grade','Grade'],['points','Points']],'student-transcript'));
    }catch(error){box.innerHTML='<p class="aco-empty error">'+esc(error.message)+'</p>'}});
  }
  async function loadReports(){
    shell('Academic Reports','Institution-wide academic workflow summaries with print and CSV export.');
    document.getElementById('aco-toolbar').innerHTML='<span id="aco-count" class="aco-count">Live report summary</span><button id="aco-report-refresh" class="aco-refresh" type="button">↻ Refresh</button><button id="aco-report-print" class="aco-export" type="button">Print report</button><button id="aco-report-export" class="aco-export" type="button">↓ Export CSV</button>';
    document.querySelector('.aco-table-wrap').innerHTML='<div id="aco-report-grid" class="aco-report-grid"><div class="aco-empty">Loading reports…</div></div>';
    async function refresh(){const grid=document.getElementById('aco-report-grid');grid.innerHTML='<div class="aco-empty">Loading reports…</div>';try{const result=await request('/api/academic-officer/reports'),d=result.data||{},groups=[['Course registrations',d.registrations],['Results workflow',d.results],['Graduation workflow',d.graduations]];grid.innerHTML=groups.map(([title,items])=>'<article class="aco-report-card"><h3>'+esc(title)+'</h3>'+(Array.isArray(items)&&items.length?items.map(x=>'<div class="aco-report-row"><span>'+esc(String(x.status||'Unknown').replace(/_/g,' '))+'</span><strong>'+esc(x.count)+'</strong></div>').join(''):'<p class="aco-empty">No records available.</p>')+'</article>').join('');document.getElementById('aco-count').textContent='Updated '+new Date().toLocaleString();document.getElementById('aco-report-export').onclick=()=>exportCsv(groups.flatMap(([group,items])=>(items||[]).map(x=>({group,status:x.status,count:x.count}))),[['group','Report section'],['status','Status'],['count','Count']],'academic-reports');document.getElementById('aco-report-print').onclick=()=>window.print()}catch(error){grid.innerHTML='<div class="aco-empty error">'+esc(error.message)+'</div>'}}
    document.getElementById('aco-report-refresh').addEventListener('click',refresh);await refresh();
  }
  if(page==='transcripts')loadTranscripts();else if(page==='reports')loadReports();else loadPage(false);
})();