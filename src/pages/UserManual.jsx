import { useEffect } from 'react';

export default function UserManual() {
  useEffect(() => { document.title = 'AJW 클레임 트래커 사용 매뉴얼'; }, []);

  return (
    <div style={{ fontFamily: "'Nanum Gothic','Malgun Gothic',sans-serif", background: '#f8fafc', minHeight: '100vh' }}>

      {/* 상단 헤더 */}
      <div style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)', padding: '28px 40px 24px', color: '#fff' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ fontSize: 11, opacity: .7, marginBottom: 6, letterSpacing: 1 }}>AJW OPTICAL</div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.5px' }}>클레임 트래커 사용 매뉴얼</div>
          <div style={{ fontSize: 13, opacity: .8, marginTop: 6 }}>클레임 접수부터 종결까지 — 역할별 사용 가이드</div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px 60px' }}>

        {/* 목차 */}
        <Section color="#3b82f6">
          <SectionTitle icon="📋" title="목차" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              '1. 전체 흐름 한눈에 보기',
              '2. 클레임 접수하기',
              '3. 단계별 처리 방법',
              '4. 처리결과보고서 발행',
              '5. 수정 권한 안내',
              '6. 분석 / 대시보드 활용',
              '7. 공급사 불량 관리',
              '8. AI 종합 분석 보고서',
            ].map(item => (
              <div key={item} style={{ fontSize: 13, color: '#1e40af', padding: '6px 0', borderBottom: '1px solid #dbeafe' }}>
                {item}
              </div>
            ))}
          </div>
        </Section>

        {/* 1. 전체 흐름 */}
        <Section color="#6366f1">
          <SectionTitle icon="🗺️" title="1. 전체 흐름 한눈에 보기" />
          <p style={bodyText}>클레임은 아래 5단계로 진행됩니다. 각 단계에서 처리 내용을 기록하고 완료 버튼을 누르면 다음 단계로 넘어갑니다.</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, margin: '20px 0', flexWrap: 'wrap', gap: 4 }}>
            {[
              { stage: '접수', icon: '📥', desc: '기본 정보 등록', color: '#dbeafe', text: '#1e40af' },
              { stage: '1차 대응', icon: '🔔', desc: '영업팀 현장 처리', color: '#fef3c7', text: '#92400e' },
              { stage: '회수품\n원인분석', icon: '🔍', desc: '품질팀 원인 분석', color: '#ede9fe', text: '#5b21b6' },
              { stage: '조치', icon: '🛠️', desc: '조치 + 재발방지', color: '#ffedd5', text: '#9a3412' },
              { stage: '종결', icon: '✅', desc: '보고서 발행', color: '#d1fae5', text: '#065f46' },
            ].map((s, i) => (
              <div key={s.stage} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{
                  background: s.color, color: s.text, borderRadius: 10, padding: '10px 16px',
                  textAlign: 'center', minWidth: 90,
                }}>
                  <div style={{ fontSize: 20 }}>{s.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4, whiteSpace: 'pre-line' }}>{s.stage}</div>
                  <div style={{ fontSize: 10, opacity: .8, marginTop: 2 }}>{s.desc}</div>
                </div>
                {i < 4 && <div style={{ fontSize: 18, color: '#94a3b8' }}>→</div>}
              </div>
            ))}
          </div>
          <InfoBox>
            <strong>핵심 원칙:</strong> 각 단계에서 처리를 <em>완료한 후</em> 결과를 입력하고 "완료" 버튼을 누릅니다. 미리 입력하는 것이 아니라, 실제로 처리한 내용을 기록하는 방식입니다.
          </InfoBox>
        </Section>

        {/* 2. 접수하기 */}
        <Section color="#0891b2">
          <SectionTitle icon="📥" title="2. 클레임 접수하기" />
          <p style={bodyText}>클레임을 처음 등록하는 단계입니다. 왼쪽 메뉴의 <Tag>클레임 목록</Tag> → 오른쪽 상단 <Tag>+ 새 클레임 접수</Tag> 버튼을 눌러 시작합니다.</p>

          <StepList steps={[
            { title: '고객사 정보 입력', desc: '고객사 그룹(KT/LG/SK 등)과 고객사명을 입력합니다. 발생일과 접수일도 확인하세요.' },
            { title: '영업담당 부서·담당자 입력', desc: '영업담당 부서를 선택하고, 담당자 이름과 연락처를 입력합니다.' },
            { title: '품번·품명 입력', desc: '품번 옆 🔍 버튼으로 품번을 검색할 수 있습니다. 품번 입력 시 품명이 자동으로 채워집니다.' },
            { title: '수량·LOT·불량 정보 입력', desc: '출고 수량, LOT 번호, 불량 수량을 입력합니다. 불량률은 자동 계산됩니다.' },
            { title: '품목 유형·품목군 선택', desc: '수입품/자체제작상품/내수품 중 하나, 품목군(광분배함류 등)을 선택합니다.' },
            { title: '불량 내용 작성', desc: '어떤 불량이 발생했는지 구체적으로 입력합니다. 고객 신고 내용을 그대로 기재해도 됩니다.' },
            { title: '접수 등록', desc: '"클레임 접수" 버튼을 누르면 접수가 완료되고, 자동으로 1차 대응 단계로 이동합니다.' },
          ]} />
        </Section>

        {/* 3. 단계별 처리 */}
        <Section color="#d97706">
          <SectionTitle icon="⚙️" title="3. 단계별 처리 방법" />

          <SubTitle>🔔 1차 대응 — 영업팀</SubTitle>
          <p style={bodyText}>고객 현장을 방문하거나 연락을 취해 초기 대응을 완료한 후 기록합니다.</p>
          <StepList steps={[
            { title: '처리일 확인', desc: '영업팀이 실제로 고객에게 연락하거나 방문한 날짜를 입력합니다.' },
            { title: '담당 부서·담당자 입력', desc: '처리한 팀(영업팀)과 담당자 이름을 입력합니다.' },
            { title: '처리 내용 작성 (필수)', desc: '예시: "고객 방문 후 LOT 번호 확인, 불량품 10EA 수거 완료. 임시로 정품 10EA 현장 교환 처리함."' },
            { title: '"1차 대응 완료" 클릭', desc: '완료 버튼을 누르면 회수품 원인분석 단계로 이동합니다.' },
          ]} />
          <InfoBox warn>처리 내용을 입력하지 않으면 완료 버튼이 작동하지 않습니다.</InfoBox>

          <SubTitle>🔍 회수품 원인분석 — 품질기술팀</SubTitle>
          <p style={bodyText}>수거한 불량품을 분석하여 원인을 파악합니다.</p>
          <StepList steps={[
            { title: '원인 분류 선택 (필수)', desc: '사용자 과실 / 생산공정 / 제품불량 / 구조불량 / 배송오류 / 기타 중 해당 항목을 선택합니다. 복수 선택 가능합니다.' },
            { title: '기타 선택 시 상세 입력', desc: '"기타"를 선택하면 구체적인 원인을 직접 입력하는 칸이 나타납니다.' },
            { title: '상세 내용 작성 (필수)', desc: '원인 분석 결과를 상세하게 기술합니다. 예: "LOT 2403-B 생산 시 경화 온도 설정 오류로 접착 불량 발생"' },
            { title: '"회수품 원인분석 완료" 클릭' },
          ]} />

          <SubTitle>🛠️ 조치 — 품질기술팀 / 영업팀</SubTitle>
          <p style={bodyText}>원인 분석 결과에 따른 실질적인 조치를 취하고 재발방지대책을 수립합니다.</p>
          <StepList steps={[
            { title: '처리 내용 작성 (필수)', desc: '예: "불량 LOT 전수 검사 후 대체품 납품 완료. 고객에게 사과 서한 발송."' },
            { title: '재발방지대책 작성 (필수)', desc: '예: "경화 공정 온도 관리 기준 강화 및 일일 점검 체크리스트 도입."' },
            { title: '"조치 완료" 클릭', desc: '완료 버튼을 누르면 클레임이 종결됩니다. 이후 처리결과보고서를 발행할 수 있습니다.' },
          ]} />
          <InfoBox warn>처리 내용과 재발방지대책 모두 필수 입력입니다.</InfoBox>
        </Section>

        {/* 4. 보고서 */}
        <Section color="#059669">
          <SectionTitle icon="📄" title="4. 처리결과보고서 발행" />
          <p style={bodyText}>클레임이 <strong>종결</strong>되면 공식 처리결과보고서를 발행할 수 있습니다.</p>
          <StepList steps={[
            { title: '종결된 클레임 상세 페이지로 이동' },
            { title: '상단 "📄 처리결과보고서" 버튼 클릭', desc: '버튼은 종결된 클레임에서만 표시됩니다.' },
            { title: '새 탭에서 보고서 확인', desc: '기본 정보, 처리 경과, 원인분석 결과, 조치내용, 재발방지대책, 서명란이 자동으로 구성됩니다.' },
            { title: '"🖨️ 인쇄 / PDF 저장" 클릭', desc: 'A4 세로 형식으로 출력하거나 PDF로 저장할 수 있습니다.' },
          ]} />
        </Section>

        {/* 5. 수정/삭제 권한 */}
        <Section color="#7c3aed">
          <SectionTitle icon="🔐" title="5. 수정 및 삭제 권한 안내" />

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                {['기능', '일반 사용자 (로그인)', '관리자'].map(h => (
                  <th key={h} style={{ border: '1px solid #d1d5db', padding: '8px 12px', textAlign: 'left', fontWeight: 700, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['클레임 접수', '✅ 가능', '✅ 가능'],
                ['클레임 내용 수정', '✅ 가능', '✅ 가능'],
                ['단계 진행 (처리 결과 입력)', '✅ 가능', '✅ 가능'],
                ['이력 항목 수정', '✅ 가능', '✅ 가능'],
                ['클레임 삭제', '⚠️ 삭제 요청만 가능', '✅ 직접 삭제 가능'],
                ['삭제 요청 승인/거절', '❌ 불가', '✅ 가능'],
                ['공급사 불량 접수/수정', '❌ 품질기술팀·관리자만', '✅ 가능'],
                ['시정조치 현황 수정', '❌ 품질기술팀·관리자만', '✅ 가능'],
                ['첨부파일 업로드/조회', '❌ 품질기술팀·관리자만', '✅ 가능'],
                ['첨부파일 삭제', '❌ 불가', '✅ 가능'],
                ['다운로드 이력 조회', '❌ 불가', '✅ 가능'],
                ['공급사·품번 관리', '❌ 불가', '✅ 가능'],
                ['누적 분석 / AI 보고서', '❌ 품질기술팀·관리자만', '✅ 가능'],
              ].map(([feature, user, admin], i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={{ border: '1px solid #d1d5db', padding: '8px 12px', fontWeight: 600 }}>{feature}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '8px 12px' }}>{user}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '8px 12px' }}>{admin}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <InfoBox style={{ marginTop: 16 }}>
            <strong>삭제 요청 절차:</strong> 일반 사용자는 클레임 상세 화면에서 "🗑 삭제 요청하기" 버튼을 눌러 사유를 입력하면, 관리자에게 알림이 전달됩니다. 관리자가 승인해야 실제 삭제됩니다.
          </InfoBox>

          <InfoBox style={{ marginTop: 12 }}>
            <strong>중복 등록 방지:</strong> 동일 클레임의 같은 단계는 한 번만 등록할 수 있습니다. 이미 처리된 단계를 다시 등록하려 하면 경고 메시지가 표시됩니다.
          </InfoBox>
        </Section>

        {/* 6. 분석/대시보드 */}
        <Section color="#0891b2">
          <SectionTitle icon="📊" title="6. 분석 및 대시보드 활용" />

          <SubTitle>대시보드</SubTitle>
          <p style={bodyText}>로그인 후 첫 화면입니다. 전체 클레임 현황 KPI(총 접수, 진행 중, 이번 달 접수 등)와 최근 클레임 목록을 한눈에 확인할 수 있습니다.</p>

          <SubTitle>클레임 목록</SubTitle>
          <p style={bodyText}>접수된 전체 클레임 목록입니다. 단계별 필터, 고객사 검색, 기간 검색을 조합해 원하는 건을 빠르게 찾을 수 있습니다.</p>

          <SubTitle>누적 분석</SubTitle>
          <p style={bodyText}>클레임 데이터를 다각도로 분석합니다. 탭별로 아래 분석을 제공합니다:</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            {[
              { tab: '고객사별', desc: '고객사별 클레임 건수, 종결율, 불량 수량' },
              { tab: '품목별', desc: '품목 유형별 현황 (수입품/자체제작/내수품)' },
              { tab: '그룹별', desc: 'KT, LG, SK 등 고객사 그룹별 비교' },
              { tab: '품목군별', desc: '광분배함류 등 품목군별 클레임 현황' },
              { tab: '원인별', desc: '불량 원인 분류별 통계' },
              { tab: '월별 추이', desc: '월별 접수량 추이 및 종결율 변화' },
            ].map(({ tab, desc }) => (
              <div key={tab} style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: '#0369a1', marginBottom: 4 }}>{tab}</div>
                <div style={{ fontSize: 12, color: '#334155' }}>{desc}</div>
              </div>
            ))}
          </div>
          <p style={{ ...bodyText, marginTop: 12 }}>기간 필터(연도/반기/분기)와 고객사 그룹 필터를 조합해 원하는 범위로 분석할 수 있습니다.</p>
        </Section>

        {/* 7. 공급사 불량 관리 */}
        <Section color="#0f766e">
          <SectionTitle icon="🏭" title="7. 공급사 불량 관리" />
          <InfoBox>
            <strong>접근 권한:</strong> 품질기술팀 · 관리자만 이용할 수 있습니다. 왼쪽 메뉴 <Tag>공급사 불량</Tag> 섹션에서 접근합니다.
          </InfoBox>

          <SubTitle>📋 불량 목록</SubTitle>
          <p style={bodyText}>입고된 공급사 불량 이력 전체를 확인합니다. 처리결과·공급사·<strong>시정조치 상태</strong>로 필터링할 수 있습니다.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
            {[
              { label: '미조치', color: '#f1f5f9', text: '#64748b', desc: '아직 시정조치 미등록' },
              { label: '진행중', color: '#fef3c7', text: '#92400e', desc: '조치 완료 전 진행 단계' },
              { label: '완료',   color: '#d1fae5', text: '#065f46', desc: '시정조치 및 검증 완료' },
            ].map(({ label, color, text, desc }) => (
              <div key={label} style={{ background: color, borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: text, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 12, color: '#475569' }}>{desc}</div>
              </div>
            ))}
          </div>
          <p style={{ ...bodyText, marginTop: 10 }}>📎 아이콘이 표시된 행은 성적서 등 첨부파일이 있는 건입니다.</p>

          <SubTitle>➕ 불량 접수</SubTitle>
          <p style={bodyText}>왼쪽 메뉴 <Tag>불량 접수</Tag> 또는 목록 우측 상단 <Tag>+ 불량 접수</Tag> 버튼으로 신규 불량을 등록합니다.</p>
          <StepList steps={[
            { title: '공급사 검색', desc: '공급사명을 입력하거나 🔍 버튼으로 등록된 공급사를 검색합니다. (공급사 관리에 미리 등록 필요)' },
            { title: '입고 정보 입력', desc: '입고일, 입고 차수(예: 2024-3차), 입고 LOT, 구매 경로(SCM팀(내수) 등)를 입력합니다.' },
            { title: '품번·품명 입력', desc: '🔍 버튼으로 품번을 검색하거나 직접 입력합니다. 불량 수량과 입고 수량을 입력하면 불량률이 자동 계산됩니다.' },
            { title: '검사 단계 선택', desc: '부품 수입검사 / 완제품 입고검사 / 출하검사 중 해당 단계를 선택합니다. "부품 수입검사" 선택 시 캐비티 수 입력란이 추가됩니다.' },
            { title: '불량 유형 및 상세 내용 입력', desc: '치수불량·외관불량·조립불량 등 유형을 선택하고, 불량 내용을 상세히 기술합니다.' },
            { title: '성적서·첨부파일 첨부 (선택)', desc: '파일 첨부 영역에 PDF, 이미지, Excel 등을 드래그하거나 클릭해서 첨부합니다. 최대 20MB.' },
            { title: '접수 등록', desc: '"불량 접수" 버튼을 눌러 완료합니다.' },
          ]} />

          <SubTitle>🔧 시정조치 현황</SubTitle>
          <p style={bodyText}>불량 상세 화면에서 <strong>🔧 시정조치 현황</strong> 카드를 통해 공급사 또는 내부의 조치 내용을 관리합니다.</p>
          <StepList steps={[
            { title: '수정 버튼 클릭', desc: '시정조치 현황 카드 우측 상단 "✏️ 수정" 버튼을 누릅니다.' },
            { title: '조치 상태 선택', desc: '미조치 → 진행중 → 완료 순으로 상태를 선택합니다.' },
            { title: '조치 유형 선택', desc: '공급사 클레임 / 작업자 교육 / 공정 변경 / 설계 변경 / 기타 중 해당 유형을 선택합니다.' },
            { title: '조치 내용 상세 입력', desc: '예) "공급사에 불량 클레임 통보 및 재발방지 대책 요청 (2024-06-30), 2차 입고분부터 전수검사 실시 예정"' },
            { title: '저장', desc: '"💾 저장" 버튼을 누르면 즉시 반영됩니다. 목록에서도 상태 배지가 업데이트됩니다.' },
          ]} />

          <SubTitle>📈 입고 차수별 개선 추적</SubTitle>
          <p style={bodyText}>시정조치 후 다음 차수 입고 시 실제로 개선됐는지 기록합니다. 상세 화면 하단 <strong>📈 입고 차수별 개선 추적</strong> 카드에서 관리합니다.</p>
          <StepList steps={[
            { title: '"➕ 차수 추가" 클릭' },
            { title: '차수·입고일·수량 입력', desc: '예: "3차", 입고일, 입고 수량, 불량 수량을 입력합니다.' },
            { title: '개선 여부 선택', desc: '확인중 / 개선 / 미개선 중 하나를 선택합니다.' },
            { title: '비고 입력 후 저장' },
          ]} />
          <InfoBox>
            <strong>개선 여부 기준:</strong> 동일 불량 유형이 재발하지 않으면 "개선", 재발하면 "미개선", 아직 판단 전이면 "확인중"으로 설정합니다.
          </InfoBox>

          <SubTitle>📎 첨부파일 (성적서)</SubTitle>
          <p style={bodyText}>불량 상세 화면 하단 <strong>📎 첨부파일</strong> 카드에서 성적서, 사진 등을 첨부하고 관리합니다.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            {[
              { icon: '👁', title: '미리보기', desc: '이미지는 팝업으로, PDF/문서는 새 탭으로 바로 확인 가능' },
              { icon: '📥', title: '다운로드', desc: '원본 파일을 다운로드합니다' },
              { icon: '🗑', title: '파일 삭제', desc: '관리자만 삭제 가능합니다' },
              { icon: '📋', title: '다운로드 이력', desc: '관리자는 누가 언제 다운로드했는지 이력을 확인할 수 있습니다' },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 4 }}>{icon} {title}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{desc}</div>
              </div>
            ))}
          </div>
          <InfoBox warn style={{ marginTop: 12 }}>
            지원 형식: PDF, JPG, PNG, GIF, WebP, Excel, Word · 파일당 최대 20MB
          </InfoBox>

          <SubTitle>📊 누적 분석</SubTitle>
          <p style={bodyText}>왼쪽 메뉴 <Tag>누적 분석</Tag>에서 공급사 불량 데이터를 분석합니다.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            {[
              { tab: '공급사별', desc: '공급사별 불량 건수, 불량률, 처리결과' },
              { tab: '품목별', desc: '품번·품명별 불량 빈도 및 불량률' },
              { tab: '불량유형별', desc: '불량 유형 분포 및 공급사 교차 분석' },
              { tab: '품목군별', desc: '광분배함류 등 품목군별 현황' },
              { tab: '처리결과별', desc: '사용승인·반품·폐기 등 처리결과 분포' },
              { tab: '월별 추이', desc: '월별 불량 발생 추이 그래프' },
            ].map(({ tab, desc }) => (
              <div key={tab} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: '#065f46', marginBottom: 4 }}>{tab}</div>
                <div style={{ fontSize: 12, color: '#334155' }}>{desc}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* 8. AI 종합 분석 보고서 */}
        <Section color="#7c3aed">
          <SectionTitle icon="🤖" title="8. AI 종합 분석 보고서" />
          <InfoBox>
            <strong>접근 권한:</strong> 품질기술팀 · 관리자만 이용할 수 있습니다. 왼쪽 메뉴 <Tag>🤖 AI 종합 분석</Tag>에서 접근합니다.
          </InfoBox>
          <p style={{ ...bodyText, marginTop: 12 }}>고객사 클레임과 공급사 불량 데이터를 통합하여 AI가 핵심 인사이트를 분석·요약해주는 기능입니다.</p>

          <SubTitle>항상 표시되는 요약 현황</SubTitle>
          <p style={bodyText}>API 키 없이도 아래 데이터가 자동으로 표시됩니다:</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            {[
              '클레임 처리 현황 KPI (종결/미결 건수)',
              '공급사 불량 현황 KPI (대기/처리 완료)',
              '주요 고객사 TOP 5',
              '주요 공급사 TOP 5',
              '클레임 불량 유형 분포',
              '공급사 처리결과 분포',
            ].map(item => (
              <div key={item} style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#6b21a8' }}>
                ✓ {item}
              </div>
            ))}
          </div>

          <SubTitle>AI 보고서 생성</SubTitle>
          <StepList steps={[
            { title: 'VITE_GEMINI_API_KEY 설정 필요', desc: 'AI 분석 기능을 사용하려면 Google Gemini API 키가 환경변수에 설정되어 있어야 합니다. (IT 담당자 문의)' },
            { title: '"🤖 AI 보고서 생성" 버튼 클릭', desc: '전체 데이터를 분석하여 보고서를 생성합니다. 수십 초 소요될 수 있습니다.' },
            { title: '보고서 내용 확인', desc: '주요 클레임 현황, 반복 불량 패턴, 공급사 품질 리스크, 개선 우선순위 등이 자동으로 작성됩니다.' },
            { title: '복사 또는 인쇄', desc: '보고서를 복사하거나 브라우저 인쇄 기능으로 PDF로 저장할 수 있습니다.' },
          ]} />
        </Section>

        <div style={{ marginTop: 40, textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
          AJW Optical 클레임 트래커 · 문의: 품질기술팀
        </div>
      </div>
    </div>
  );
}

/* ── 재사용 컴포넌트 ── */

function Section({ children, color }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '24px 28px',
      marginBottom: 20, borderLeft: `4px solid ${color}`,
      boxShadow: '0 1px 4px rgba(0,0,0,.06)',
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, title }) {
  return (
    <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span>{icon}</span>{title}
    </div>
  );
}

function SubTitle({ children }) {
  return <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '18px 0 8px', borderBottom: '1px solid #f1f5f9', paddingBottom: 6 }}>{children}</div>;
}

function StepList({ steps }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '12px 0' }}>
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%', background: '#3b82f6', color: '#fff',
            fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
          }}>{i + 1}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{step.title}</div>
            {step.desc && <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, lineHeight: 1.6 }}>{step.desc}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function InfoBox({ children, warn }) {
  return (
    <div style={{
      background: warn ? '#fffbeb' : '#eff6ff',
      border: `1px solid ${warn ? '#fcd34d' : '#bfdbfe'}`,
      borderRadius: 8, padding: '10px 14px',
      fontSize: 13, color: warn ? '#92400e' : '#1e40af',
      lineHeight: 1.6, marginTop: 10,
    }}>
      {warn ? '⚠️ ' : 'ℹ️ '}{children}
    </div>
  );
}

function Tag({ children }) {
  return (
    <span style={{
      background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 5,
      padding: '1px 6px', fontSize: 12, fontWeight: 600, color: '#334155',
    }}>{children}</span>
  );
}

const bodyText = { fontSize: 13, color: '#334155', lineHeight: 1.7, margin: '0 0 4px' };
