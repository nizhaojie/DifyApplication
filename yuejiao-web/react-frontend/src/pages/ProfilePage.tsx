import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  Button,
  Card,
  Divider,
  Drawer,
  Input,
  Pagination,
  Progress,
  Select,
  Spin,
  Table,
  Tabs,
  Tag,
  Upload,
} from 'antd'
import type { TableColumnsType } from 'antd'
import type { UploadFile } from 'antd'
import { UploadFilled } from '@/components/elementIcons'
import { toast } from '@/components/feedback'
import {
  assessByFile,
  assessByText,
  fetchProfileDetail,
  fetchProfiles,
  type AssessResult,
  type ProfileAssessment,
  type ProfileRecord,
} from '@/api/profile'
import './ProfilePage.css'

// 等价迁移自 Vue 版 前端代码/src/views/profile/index.vue(405 行)。

const PAGE_SIZE = 10

// ---------- 研判工作台:结果元信息(与 Vue RESULT_META 一致) ----------
const RESULT_META: Record<string, { label: string; type: 'success' | 'warning' | 'danger' }> = {
  matched: { label: '匹配', type: 'success' },
  partial: { label: '部分匹配', type: 'warning' },
  not_matched: { label: '不匹配', type: 'danger' },
}

function resultMeta(v?: string | null) {
  return (v && RESULT_META[v]) || { label: v || '-', type: 'info' as const }
}

// el-tag type(默认=info)的 Element Plus 默认配色(light-8 边框 / light-9 底色),内联对齐 EP 色值
const EP_TAG_LIGHT: Record<'success' | 'warning' | 'danger' | 'info', CSSProperties> = {
  success: { color: '#67c23a', background: '#f0f9eb', borderColor: '#e1f3d8' },
  warning: { color: '#e6a23c', background: '#fdf6ec', borderColor: '#faecd8' },
  danger: { color: '#f56c6c', background: '#fef0f0', borderColor: '#fde2e2' },
  info: { color: '#909399', background: '#f4f4f5', borderColor: '#e9e9eb' },
}

// el-tag type="success" effect="plain"(白底 + light-8 边框)
const EP_TAG_PLAIN_SUCCESS: CSSProperties = { color: '#67c23a', background: '#ffffff', borderColor: '#e1f3d8' }

/** el-tag 的配色等价物(匹配/部分匹配/不匹配) */
function ResultTag({ value, small }: { value?: string | null; small?: boolean }) {
  const meta = resultMeta(value)
  return (
    <Tag style={EP_TAG_LIGHT[meta.type]} className={small ? 'ep-tag-sm' : undefined}>
      {meta.label}
    </Tag>
  )
}

function fmtScore(v?: number | null): string {
  return v == null ? '-' : `${Number(v).toFixed(1)} 分`
}

/** 命中规则项列(Vue: 命中标签,没有则显示「无」) */
function MatchedLabelsCell({ labels }: { labels: string[] }) {
  return (
    <>
      {labels?.map((l) => (
        <Tag key={l} style={EP_TAG_LIGHT.info} className="ep-tag-sm hit-tag">
          {l}
        </Tag>
      ))}
      {!labels?.length && <span className="muted">无</span>}
    </>
  )
}

// ---------- 研判结果表格(Vue: 产品线/规则/结果/得分/命中规则项/候选专业项目) ----------
const assessmentColumns: TableColumnsType<ProfileAssessment> = [
  { title: '产品线', dataIndex: 'product_line', minWidth: 150 },
  { title: '规则', dataIndex: 'rule_name', minWidth: 150, ellipsis: true },
  { title: '结果', dataIndex: 'match_result', width: 100, render: (_, row) => <ResultTag value={row.match_result} small /> },
  { title: '得分', dataIndex: 'match_score', width: 90, render: (_, row) => fmtScore(row.match_score) },
  {
    title: '命中规则项',
    key: 'matched_labels',
    minWidth: 180,
    render: (_, row) => <MatchedLabelsCell labels={row.matched_labels} />,
  },
  {
    title: '候选专业/项目',
    key: 'candidate_programs',
    minWidth: 200,
    render: (_, row) => (
      <>
        {row.candidate_programs?.map((c, index) => (
          <div className="cand-block" key={`${c.category}-${index}`}>
            <span className="cand-cat">{c.category}：</span>
            {(c.programs ?? []).join('、')}
          </div>
        ))}
        {!row.candidate_programs?.length && <span className="muted">无</span>}
      </>
    ),
  },
]

// ---------- 详情抽屉里的重算表格(Vue: 产品线/结果/得分/命中规则项) ----------
const detailColumns: TableColumnsType<ProfileAssessment> = [
  { title: '产品线', dataIndex: 'product_line', minWidth: 150 },
  { title: '结果', dataIndex: 'match_result', width: 100, render: (_, row) => <ResultTag value={row.match_result} small /> },
  { title: '得分', dataIndex: 'match_score', width: 90, render: (_, row) => fmtScore(row.match_score) },
  {
    title: '命中规则项',
    key: 'matched_labels',
    minWidth: 200,
    render: (_, row) => <MatchedLabelsCell labels={row.matched_labels} />,
  },
]

export function ProfilePage() {
  // ---------- 研判工作台 ----------
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text')
  const [inputText, setInputText] = useState('')
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [pickedFile, setPickedFile] = useState<File | null>(null)
  const [assessing, setAssessing] = useState(false)
  const [result, setResult] = useState<AssessResult | null>(null)

  // ---------- 研判记录 ----------
  const [records, setRecords] = useState<ProfileRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [matchResult, setMatchResult] = useState('')
  const [loadingRecords, setLoadingRecords] = useState(false)

  const loadRecords = useCallback(async () => {
    setLoadingRecords(true)
    try {
      const resp = await fetchProfiles({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        match_result: matchResult || undefined,
      })
      setRecords(resp.items)
      // Vue: resp.total ?? records.value.length(react api 层把 null 归一成 0,用 || 复现同样回退)
      setTotal(resp.total || resp.items.length)
    } catch {
      // http 拦截器已弹错误提示
    } finally {
      setLoadingRecords(false)
    }
  }, [page, matchResult])

  useEffect(() => {
    void loadRecords()
  }, [loadRecords])

  // ---------- 详情抽屉 ----------
  const [detailVisible, setDetailVisible] = useState(false)
  const [detail, setDetail] = useState<AssessResult | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  async function openDetail(row: ProfileRecord) {
    setDetailVisible(true)
    setDetailLoading(true)
    setDetail(null)
    try {
      setDetail(await fetchProfileDetail(row.id))
    } catch {
      // http 拦截器已弹错误提示
    } finally {
      setDetailLoading(false)
    }
  }

  function onFileChange(info: { file: UploadFile; fileList: UploadFile[] }) {
    // 对齐 Vue `:limit="1"`:已有文件时忽略新的选择(antd maxCount=1 默认会替换)
    if (pickedFile && info.file.uid !== fileList[0]?.uid) return
    const entry = info.fileList.find((item) => item.uid === info.file.uid)
    setFileList(info.fileList)
    setPickedFile((entry?.originFileObj ?? (info.file as unknown)) as File | null)
  }

  function onFileRemove() {
    setFileList([])
    setPickedFile(null)
  }

  async function submitAssess() {
    if (activeTab === 'text' && !inputText.trim()) {
      toast.warning('请粘贴客户信息文本')
      return
    }
    if (activeTab === 'file' && !pickedFile) {
      toast.warning('请选择 PDF 简历或 Excel 文件')
      return
    }
    setAssessing(true)
    setResult(null)
    try {
      setResult(activeTab === 'text' ? await assessByText(inputText.trim()) : await assessByFile(pickedFile!))
      toast.success('研判完成')
      void loadRecords()
    } catch {
      // http 拦截器已弹错误提示
    } finally {
      setAssessing(false)
    }
  }

  // ---------- 研判记录表格列 ----------
  const recordColumns: TableColumnsType<ProfileRecord> = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '客户', dataIndex: 'customer_name', width: 120, render: (_, row) => row.customer_name || '（未识别）' },
    { title: '匹配结果', dataIndex: 'match_result', width: 100, render: (_, row) => <ResultTag value={row.match_result} small /> },
    { title: '匹配产品线', dataIndex: 'matched_product', minWidth: 170 },
    { title: '匹配度', dataIndex: 'match_score', width: 90, render: (_, row) => fmtScore(row.match_score) },
    { title: '研判时间', dataIndex: 'create_time', minWidth: 160, ellipsis: true },
    {
      title: '操作',
      key: 'action',
      width: 80,
      fixed: 'right',
      render: (_, row) => (
        <Button type="link" size="small" onClick={() => void openDetail(row)}>
          详情
        </Button>
      ),
    },
  ]

  const scorePercent = result ? Math.min(100, Math.round(result.match_score ?? 0)) : 0

  return (
    <div className="profile-page">
      {/* 研判工作台 */}
      <Card
        className="panel"
        title={<span className="panel-title">客户研判工作台</span>}
        extra={
          <span className="panel-sub">
            判断客户是否符合「中德精英人才共建计划 / 新加坡国际本硕升学计划」画像并给出专业推荐
          </span>
        }
        styles={{ header: { padding: '18px 20px' }, body: { padding: 20 } }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'text' | 'file')}
          items={[
            {
              key: 'text',
              label: '文本输入',
              children: (
                <Input.TextArea
                  rows={6}
                  maxLength={8000}
                  showCount
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)}
                  placeholder="粘贴客户信息文本，例如：王某，22岁，大专毕业，家庭年收入30-50万，英语四级，想去新加坡读专升本…"
                />
              ),
            },
            {
              key: 'file',
              label: '文件上传',
              children: (
                <Upload.Dragger
                  className="profile-upload"
                  accept=".pdf,.xlsx,.xls"
                  multiple={false}
                  maxCount={1}
                  beforeUpload={() => false}
                  fileList={fileList}
                  onChange={onFileChange}
                  onRemove={onFileRemove}
                >
                  <p className="ant-upload-drag-icon">
                    <UploadFilled size={67} />
                  </p>
                  <p className="ant-upload-text">
                    拖拽 PDF 简历 / Excel 到此处，或<em>点击选择</em>
                  </p>
                  <p className="ant-upload-hint">支持 PDF 简历与 Excel（首行为表头，一行一个客户）</p>
                </Upload.Dragger>
              ),
            },
          ]}
        />

        <div className="submit-row">
          <Button type="primary" loading={assessing} onClick={() => void submitAssess()}>
            开始研判
          </Button>
        </div>

        {/* 研判结果 */}
        {result && (
          <>
            <Divider titlePlacement="left">研判结果</Divider>
            <div className="result-grid">
              <div className="result-item">
                <span className="result-label">客户</span>
                <span>{result.customer_name || '（未识别姓名）'}</span>
              </div>
              <div className="result-item">
                <span className="result-label">匹配结果</span>
                <ResultTag value={result.match_result} />
              </div>
              <div className="result-item">
                <span className="result-label">匹配产品线</span>
                <span>{result.matched_product || '-'}</span>
              </div>
              <div className="result-item">
                <span className="result-label">匹配度</span>
                <Progress
                  className="score-bar"
                  percent={scorePercent}
                  strokeWidth={6}
                  status={result.match_result === 'matched' ? 'success' : result.match_result === 'not_matched' ? 'exception' : 'normal'}
                />
              </div>
            </div>

            {result.match_reason && (
              <div className="reason-block">
                <span className="result-label">研判依据</span>
                <p>{result.match_reason}</p>
              </div>
            )}

            {result.recommended_programs?.length ? (
              <div className="reason-block">
                <span className="result-label">推荐专业/项目</span>
                <div>
                  {result.recommended_programs.map((p) => (
                    <Tag key={p} style={EP_TAG_PLAIN_SUCCESS} className="prog-tag">
                      {p}
                    </Tag>
                  ))}
                </div>
              </div>
            ) : null}

            {result.assessments?.length ? (
              <Table
                className="assess-table"
                size="small"
                bordered
                rowKey={(row) => `${row.product_line}-${row.rule_name ?? ''}`}
                columns={assessmentColumns}
                dataSource={result.assessments}
                pagination={false}
              />
            ) : null}
          </>
        )}
      </Card>

      {/* 研判记录 */}
      <Card
        className="panel"
        title={<span className="panel-title">研判记录</span>}
        extra={
          <Select
            value={matchResult || undefined}
            placeholder="全部结果"
            allowClear
            style={{ width: 140 }}
            options={[
              { label: '匹配', value: 'matched' },
              { label: '部分匹配', value: 'partial' },
              { label: '不匹配', value: 'not_matched' },
            ]}
            onChange={(value) => {
              setPage(1)
              setMatchResult(value ?? '')
            }}
          />
        }
        styles={{ header: { padding: '18px 20px' }, body: { padding: 20 } }}
      >
        <Table
          size="small"
          bordered
          rowKey="id"
          columns={recordColumns}
          dataSource={records}
          loading={loadingRecords}
          pagination={false}
        />
        <Pagination
          className="pager"
          current={page}
          pageSize={PAGE_SIZE}
          total={total}
          showSizeChanger={false}
          showTotal={(count) => `共 ${count} 条`}
          onChange={(next) => setPage(next)}
        />
      </Card>

      {/* 详情抽屉 */}
      <Drawer
        open={detailVisible}
        title="研判详情"
        width="55%"
        onClose={() => setDetailVisible(false)}
      >
        <Spin spinning={detailLoading}>
          {detail && (
            <>
              <div className="result-grid">
                <div className="result-item">
                  <span className="result-label">客户</span>
                  <span>{detail.customer_name || '（未识别）'}</span>
                </div>
                <div className="result-item">
                  <span className="result-label">匹配结果</span>
                  <ResultTag value={detail.match_result} />
                </div>
                <div className="result-item">
                  <span className="result-label">匹配产品线</span>
                  <span>{detail.matched_product || '-'}</span>
                </div>
                <div className="result-item">
                  <span className="result-label">匹配度</span>
                  <span>{fmtScore(detail.match_score)}</span>
                </div>
              </div>
              {detail.match_reason && (
                <div className="reason-block">
                  <span className="result-label">研判依据</span>
                  <p>{detail.match_reason}</p>
                </div>
              )}
              {detail.recommended_programs?.length ? (
                <div className="reason-block">
                  <span className="result-label">推荐专业/项目</span>
                  <div>
                    {detail.recommended_programs.map((p) => (
                      <Tag key={p} style={EP_TAG_PLAIN_SUCCESS} className="prog-tag">
                        {p}
                      </Tag>
                    ))}
                  </div>
                </div>
              ) : null}
              <Divider titlePlacement="left">按当前规则重算的产品线评估</Divider>
              <Table
                size="small"
                bordered
                rowKey={(row, index) => `${row.product_line}-${index ?? 0}`}
                columns={detailColumns}
                dataSource={detail.assessments ?? []}
                pagination={false}
              />
            </>
          )}
        </Spin>
      </Drawer>
    </div>
  )
}
