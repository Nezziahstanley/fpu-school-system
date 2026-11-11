(function () {
  'use strict';
  const core = window.FPU_PORTAL || {};
  const root = document.getElementById('aco-workspace');
  if (!root || root.dataset.bound === '1') return;
  root.dataset.bound = '1';
  const page = root.dataset.page;
  const config = {
    sessions: { title: 'Academic Sessions', subtitle: 'Review academic calendars and identify the current session.', endpoint: '/api/academic-officer/sessions', columns: [['name','Session'],['startDate','Start date'],['endDate','End date'],['isCurrent','Current']] },
    programmes: { title: 'Programmes', subtitle: 'Review programmes, qualification levels and department ownership.', endpoint: '/api/academic-officer/programmes', columns: [['code','Code'],['name','Programme'],['level','Level'],['departmentName','Department'],['durationYears','Duration (years)']] },
    departments: { title: 'Departments', subtitle: 'View departments and their parent schools.', endpoint: '/api/academic-officer/departments', columns: [['code','Code'],['name','Department'],['schoolName','School']] },
    courses: { title: 'Course Catalogue', subtitle: 'Browse courses by code, programme, level and semester.', endpoint: '/api/academic-officer/courses', columns: [['code','Code'],['title','Course'],['unit','Units'],['level','Level'],['semesterName','Semester'],['departmentName','Department']] },
    results: { title: 'Published Results', subtitle: 'Read-only oversight of results already published to students.', endpoint: '/api/academic-officer/results', columns: [['studentName','Student'],['studentMatric','Matric number'],['courseCode','Course'],['courseTitle','Course title'],['score','Score'],['grade','Grade'],['semester','Semester'],['publishedAt','Published']] },
    graduation: { title: 'Graduation Pipeline', subtitle: 'Monitor student graduation records and their current status.', endpoint: '/api/academic-officer/graduation', columns: [['student','Student'],['graduation','Graduation status'],['createdAt','Submitted']] }
  };
  const esc = (value) => core.escapeHtml ? core.escapeHtml(value == null ? '' : String(value)) : String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = value => value ? new Date(value).toLocaleDateString('en-GB') : '—';
  const normalize = row => {
    if (page === 'graduation') return {
      student: row.student ? [row.student.firstName,row.student.lastName,row.student.matricNumber].filter(Boolean).join(' ') : '—',
      graduation: row.graduation?.status || '—',
      createdAt: row.graduation?.createdAt
    };
    return row;
  };
  const cell = (row,key) => {
    const value = row[key];
    if (key === 'startDate' || key === 'endDate' || key === 'publishedAt' || key === 'createdAt') return esc(date(value));
    if (key === 'isCurrent') return value ? '<span class="aco-pill current">Current</span>' : '<span class="aco-pill">No</span>';
    if (key === 'grade') return '<strong>'+esc(value || '—')+'</strong>';
    return esc(value == null || value === '' ? '—' : value);
  };
  function shell(title,subtitle) {
    root.innerHTML = '<section class="aco-page-head"><div><span class="aco-eyebrow">ACADEMIC OFFICE</span><h2>'+esc(title)+'</h2><p>'+esc(subtitle)+'</p></div><button class="aco-refresh" type="button" id="aco-refresh">↻ Refresh</button></section><section class="aco-panel"><div class="aco-toolbar"><input id="aco-search" type="search" placeholder="Search records..." aria-label="Search records"><span id="aco-count" class="aco-count">Loading records…</span></div><div class="aco-table-wrap"><table class="aco-table"><thead id="aco-head"></thead><tbody id="aco-body"><tr><td class="aco-empty">Loading records…</td></tr></tbody></table></div></section>';
  }
  async function request(url) {
    if (!core.portalFetch) throw new Error('Portal API client is unavailable. Please sign in again.');
    const response = await core.portalFetch(url);
    if (response && response.success === false) throw new Error(response.error || 'Unable to load records.');
    return response;
  }
  async function loadTable() {
    const cfg = config[page];
    shell(cfg.title,cfg.subtitle);
    const body = document.getElementById('aco-body');
    const head = document.getElementById('aco-head');
    const count = document.getElementById('aco-count');
    head.innerHTML = '<tr>'+cfg.columns.map(c=>'<th>'+esc(c[1])+'</th>').join('')+'</tr>';
    let rows = [];
    async function refresh() {
      body.innerHTML = '<tr><td colspan="'+cfg.columns.length+'" class="aco-empty">Loading records…</td></tr>';
      try {
        const result = await request(cfg.endpoint);
        rows = Array.isArray(result.data) ? result.data : [];
        render();
      } catch (error) {
        body.innerHTML = '<tr><td colspan="'+cfg.columns.length+'" class="aco-empty error">'+esc(error.message)+'</td></tr>';
        count.textContent = 'Could not load records';
        core.showToast && core.showToast(error.message,'error');
      }
    }
    function render() {
      const q = (document.getElementById('aco-search').value || '').trim().toLowerCase();
      const filtered = rows.map(normalize).filter(row => !q || Object.values(row).some(v => String(v == null ? '' : v).toLowerCase().includes(q)));
      count.textContent = filtered.length+' of '+rows.length+' records';
      body.innerHTML = filtered.length ? filtered.map(row=>'<tr>'+cfg.columns.map(c=>'<td>'+cell(row,c[0])+'</td>').join('')+'</tr>').join('') : '<tr><td colspan="'+cfg.columns.length+'" class="aco-empty">No matching records found.</td></tr>';
    }
    document.getElementById('aco-search').addEventListener('input',render);
    document.getElementById('aco-refresh').addEventListener('click',refresh);
    await refresh();
  }
  async function loadReports() {
    shell('Academic Reports','A consolidated view of registration, result and graduation workflow statuses.');
    const body = document.getElementById('aco-body');
    const head = document.getElementById('aco-head');
    document.querySelector('.aco-toolbar').innerHTML = '<span id="aco-count" class="aco-count">Live workflow summary</span>';
    document.querySelector('.aco-table-wrap').innerHTML = '<div id="aco-report-grid" class="aco-report-grid"><div class="aco-empty">Loading academic reports…</div></div>';
    const grid = document.getElementById('aco-report-grid');
    const refresh = async () => {
      grid.innerHTML = '<div class="aco-empty">Loading academic reports…</div>';
      try {
        const result = await request('/api/academic-officer/reports');
        const data = result.data || {};
        const groups = [['Course registrations',data.registrations],['Results workflow',data.results],['Graduation workflow',data.graduations]];
        grid.innerHTML = groups.map(([title,items])=>'<article class="aco-report-card"><h3>'+esc(title)+'</h3>'+(Array.isArray(items)&&items.length?items.map(item=>'<div class="aco-report-row"><span>'+esc(String(item.status||'Unknown').replace(/_/g,' '))+'</span><strong>'+esc(item.count)+'</strong></div>').join(''):'<p class="aco-empty">No records available.</p>')+'</article>').join('');
      } catch(error) {
        grid.innerHTML = '<div class="aco-empty error">'+esc(error.message)+'</div>';
        core.showToast && core.showToast(error.message,'error');
      }
    };
    document.getElementById('aco-refresh').addEventListener('click',refresh);
    await refresh();
  }
  async function loadTranscripts() {
    shell('Transcript Lookup','Retrieve a student’s published academic record and CGPA summary using their student ID.');
    document.querySelector('.aco-toolbar').innerHTML = '<form id="aco-transcript-form" class="aco-lookup-form"><label for="aco-student-id">Student ID</label><input id="aco-student-id" type="number" min="1" required placeholder="Enter student ID"><button class="aco-refresh" type="submit">Look up transcript</button></form>';
    document.querySelector('.aco-table-wrap').innerHTML = '<div id="aco-transcript-result" class="aco-transcript-result"><p class="aco-empty">Enter a student ID to retrieve the transcript.</p></div>';
    const form=document.getElementById('aco-transcript-form'), resultBox=document.getElementById('aco-transcript-result');
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const id=Number(document.getElementById('aco-student-id').value);
      if(!Number.isInteger(id)||id<1) return;
      resultBox.innerHTML='<p class="aco-empty">Retrieving transcript…</p>';
      try {
        const result=await request('/api/academic-officer/transcripts?studentId='+encodeURIComponent(id));
        const student=result.student||{};
        const summary=result.summary||{};
        const rows=Array.isArray(result.rows)?result.rows:[];
        resultBox.innerHTML='<div class="aco-transcript-summary"><div><small>STUDENT</small><strong>'+esc([student.firstName,student.lastName].filter(Boolean).join(' ')||'Student')+'</strong><span>'+esc(student.matricNumber||'')+'</span></div><div><small>CGPA</small><strong>'+esc(summary.cgpa??'—')+'</strong><span>'+esc(summary.classification||'Classification pending')+'</span></div><div><small>COURSES</small><strong>'+rows.length+'</strong><span>Published records</span></div></div><div class="aco-table-wrap"><table class="aco-table"><thead><tr><th>Course</th><th>Title</th><th>Units</th><th>Grade</th><th>Score</th><th>Semester</th></tr></thead><tbody>'+ (rows.length?rows.map(r=>'<tr><td>'+esc(r.course?.code||'—')+'</td><td>'+esc(r.course?.title||'—')+'</td><td>'+esc(r.course?.unit??'—')+'</td><td>'+esc(r.result?.grade||'—')+'</td><td>'+esc(r.result?.score??'—')+'</td><td>'+esc(r.result?.semester||'—')+'</td></tr>').join(''):'<tr><td colspan="6" class="aco-empty">No published transcript records found.</td></tr>')+'</tbody></table></div>';
      } catch(error) {
        resultBox.innerHTML='<p class="aco-empty error">'+esc(error.message)+'</p>';
      }
    });
  }
  if (page === 'reports') loadReports();
  else if (page === 'transcripts') loadTranscripts();
  else if (config[page]) loadTable();
})();
