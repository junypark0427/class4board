const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert = require('node:assert/strict');
(async()=>{
 require('node:fs').mkdirSync('docs/previews',{recursive:true});
 const browser = await chromium.launch({...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {}),headless:true});
 const page = await browser.newPage({viewport:{width:1440,height:1000}});
 page.setDefaultTimeout(15000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3000');
 await page.getByRole('heading',{name:/사랑하는 4반/}).waitFor();
 assert.equal(await page.getByRole('button',{name:'익명으로 의견 보내기'}).isDisabled(),true);
 await page.screenshot({path:'docs/previews/student-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'docs/previews/student-mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.setViewportSize({width:320,height:800});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.goto('http://127.0.0.1:3000/admin');
 await page.getByRole('heading',{name:'관리자 로그인'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'로그인',exact:true}).isDisabled(),true);
 await page.setViewportSize({width:1440,height:1000});
 await page.screenshot({path:'docs/previews/admin-login.png',fullPage:true});
 const blocked=await page.goto('http://127.0.0.1:3000/posts/00000000-0000-4000-8000-000000000001');
 await page.getByRole('heading',{name:'공개된 글은 없어요'}).waitFor();
 // Isolated UI fixtures. Requests never reach Supabase and these records are not saved.
 const receipt='c'.repeat(64);
 let post={id:'00000000-0000-4000-8000-000000000010',category:'건의사항',title:'[화면 테스트] 자습 시간에 창문을 열면 좋겠어요',content:'이 의견은 화면 검사용 예시입니다. 실제 학생이 제출한 내용이 아닙니다.',teacher_requested:true,reply_requested:true,status:'unread',hidden:false,admin_note:'',reply:'',version:1,created_at:'2026-09-23T01:30:00Z',updated_at:'2026-09-23T01:30:00Z'};
 const uid='00000000-0000-4000-8000-000000000001';
 const user={id:uid,aud:'authenticated',role:'authenticated',email:'test-admin@example.com',app_metadata:{},user_metadata:{},created_at:'2026-09-23T00:00:00Z'};
 let actions=[];
 await page.route('https://class4-test.supabase.co/**',async route=>{
  const u=new URL(route.request().url());
  const fulfill=(data,status=200,headers={})=>route.fulfill({status,contentType:'application/json',headers,body:JSON.stringify(data)});
  if(u.pathname==='/auth/v1/token')return fulfill({access_token:'test.access.token',refresh_token:'test-refresh',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user});
  if(u.pathname==='/auth/v1/user')return fulfill(user);
  if(u.pathname==='/auth/v1/logout')return fulfill({});
  if(u.pathname==='/rest/v1/admin_members')return fulfill({display_name:'반장 (화면 테스트)'});
  if(u.pathname==='/rest/v1/admin_actions')return fulfill(actions);
  if(u.pathname==='/rest/v1/posts'){
   let rows=[post];if(u.searchParams.get('category') && u.searchParams.get('category')!=='eq.'+post.category) rows=[];
   if(u.searchParams.get('status') && u.searchParams.get('status')!=='eq.'+post.status) rows=[];
   if(u.searchParams.get('hidden') && u.searchParams.get('hidden')!=='eq.'+post.hidden) rows=[];
   return fulfill(rows,200,{'content-range':`0-${Math.max(0,rows.length-1)}/${rows.length}`});
  }
  if(u.pathname==='/rest/v1/rpc/moderate_post'){
   const b=route.request().postDataJSON();assert.equal(b.p_id,post.id);
   actions.unshift({id:actions.length+1,actor_name:'반장 (화면 테스트)',created_at:new Date().toISOString(),changes:{status:[post.status,b.p_status],admin_note_changed:true,reply_changed:true,hidden:b.p_hidden}});
   post={...post,status:b.p_status,admin_note:b.p_admin_note,reply:b.p_reply,hidden:b.p_hidden,version:post.version+1};return fulfill(null);
  }
  throw new Error('Unexpected test request '+u.pathname);
 });
 await page.route('http://127.0.0.1:3001/api/posts',async route=>{
  const body=route.request().postDataJSON();assert.equal(body.teacher_requested,true);assert.equal(body.reply_requested,true);assert.equal(body.visibility,undefined);
  return route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({ok:true,receipt})});
 });
 await page.route('http://127.0.0.1:3001/api/result',async route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({result:{status:'completed',reply:'화면 테스트 답변입니다.',updated_at:new Date().toISOString()}})}));
 console.log('UI: public guard checks passed; testing submit');
 await page.goto('http://127.0.0.1:3001');
 await page.getByLabel('제목').fill('테스트 의견');await page.locator('textarea[name=content]').fill('실제 제출이 아닌 화면 동작 테스트입니다.');
 await page.getByRole('checkbox',{name:/선생님께 전달/}).check();await page.getByRole('checkbox',{name:/답변이나 처리/}).check();
 await page.getByRole('button',{name:'익명으로 의견 보내기'}).click();
 await page.getByRole('heading',{name:/소중한 의견 고마워요/}).waitFor();
 assert.equal(await page.locator('code').textContent(),receipt);
 await page.goto('http://127.0.0.1:3001/result');await page.getByLabel('비밀 확인번호',{exact:true}).fill(receipt);await page.getByRole('button',{name:'처리 결과 확인',exact:true}).click();await page.getByText('화면 테스트 답변입니다.').waitFor();
 console.log('UI: submit and result passed; testing admin');
 await page.goto('http://127.0.0.1:3001/admin');await page.getByLabel('관리자 이메일').fill('test-admin@example.com');await page.getByLabel('비밀번호',{exact:true}).fill('not-a-real-password');await page.getByRole('button',{name:'로그인',exact:true}).click();
 await page.getByRole('heading',{name:'우리 반의 목소리'}).waitFor(); console.log('UI: admin login passed');
 await page.getByRole('button',{name:/자습 시간에/}).click();
 await page.getByRole('textbox',{name:/관리자 메모/}).fill('테스트 메모: 두 관리자만 확인합니다.');
 await page.getByRole('textbox',{name:/작성자에게 전할 답변/}).fill('테스트 답변: 선생님께 전달했어요.');
 await page.locator('.editor select').selectOption('forwarded');
 await page.getByRole('button',{name:'변경사항 저장'}).click();
 await page.getByRole('button',{name:/자습 시간에/}).click();
 await page.getByText('관리자 작업 기록',{exact:true}).waitFor();
 await page.screenshot({path:'docs/previews/admin-dashboard-test.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'docs/previews/admin-mobile-test.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.getByRole('checkbox',{name:/이 의견 숨기기/}).check();await page.getByRole('button',{name:'변경사항 저장'}).click();
 await page.getByRole('heading',{name:'해당하는 의견이 없어요'}).waitFor();
 await page.getByLabel('표시 범위').selectOption('hidden');await page.getByRole('button',{name:/자습 시간에/}).waitFor();
 await page.getByRole('button',{name:'로그아웃',exact:true}).click();await page.getByRole('heading',{name:'관리자 로그인'}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS: desktop, 390px/320px mobile, configuration guard, public route blocked, student submission/result UI, admin login/filter/status/note/reply/hide/audit/logout (fixtures).');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
