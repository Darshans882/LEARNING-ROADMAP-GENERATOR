import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen, CheckCircle2, Clock, ExternalLink, Filter, Globe2, GraduationCap, Play,
  Search, Sparkles, Star, Tag, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api, { errorMessage, pretty, titleCase } from '../api/client'
import {
  Alert, Badge, Button, Card, EmptyState, Loading, Modal, PageHeader, Select,
  Spinner, VerifiedBadge,
} from '../components/ui'

const SORT_OPTIONS = [
  { value: 'recommended', label: 'Best verified matches' },
  { value: 'title', label: 'Title A → Z' },
  { value: 'duration', label: 'Shortest first' },
  { value: 'price', label: 'Free first' },
]

function CourseCard({ course, onOpen, onProgress, busyId }) {
  const verifiedDirect = course.verified && course.link_type === 'direct'
  return (
    <Card className="flex h-full flex-col p-4 transition hover:border-brand-200 hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {course.platform} · {titleCase(course.category)}
          </p>
          <h3 className="mt-0.5 line-clamp-2 text-sm font-bold leading-snug text-slate-900">{course.title}</h3>
        </div>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${verifiedDirect ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
          {verifiedDirect ? <CheckCircle2 className="h-4 w-4" /> : <Globe2 className="h-4 w-4" />}
        </span>
      </div>

      <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{course.description}</p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge tone="slate">{titleCase(course.difficulty)}</Badge>
        <Badge tone={course.price_type === 'Free' ? 'emerald' : 'slate'}>
          {course.price_type === 'Free' ? 'Free' : course.price_type}{course.price_usd ? ` · $${course.price_usd}` : ''}
        </Badge>
        <Badge tone="slate" icon={Clock}>
          {course.duration_hours ? `${Math.round(course.duration_hours)}h` : 'n/a'}
          {course.duration_is_estimate && course.duration_hours ? ' est.' : ''}
        </Badge>
        {course.certificate ? <Badge tone="violet" icon={GraduationCap}>Certificate</Badge> : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {(course.skills || []).slice(0, 4).map((skill) => (
          <span key={skill} className="chip border border-slate-100 bg-slate-50 text-slate-500">{pretty(skill)}</span>
        ))}
        {(course.skills || []).length > 4 ? <span className="chip text-slate-400">+{course.skills.length - 4}</span> : null}
      </div>

      <div className="mt-auto flex items-center gap-2 pt-3">
        <VerifiedBadge verified={course.verified} linkType={course.link_type} className="!text-[10px]" />
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => onOpen(course)} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100">
            Details
          </button>
          <button
            type="button"
            onClick={() => onProgress(course, 'completed')}
            disabled={busyId === course.course_id}
            className="rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
          >
            {busyId === course.course_id ? 'Saving…' : 'Mark done'}
          </button>
          <a
            href={course.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="rounded-lg p-1.5 text-brand-600 hover:bg-brand-50"
            aria-label={`Open ${course.title}`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </Card>
  )
}

export default function Courses() {
  const [filters, setFilters] = useState(null)
  const [courses, setCourses] = useState([])
  const [total, setTotal] = useState(0)
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [selected, setSelected] = useState(null)
  const [related, setRelated] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [limit, setLimit] = useState(24)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [platform, setPlatform] = useState('')
  const [category, setCategory] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [priceType, setPriceType] = useState('')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [sort, setSort] = useState('recommended')
  const [showFilters, setShowFilters] = useState(false)
  const requestId = useRef(0)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 320)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    Promise.all([
      api.get('/courses/filters'),
      api.get('/courses/recommendations', { params: { limit: 6 } }).catch(() => ({ data: [] })),
    ])
      .then(([filtersResponse, recsResponse]) => {
        setFilters(filtersResponse.data)
        setRecommendations(recsResponse.data || [])
      })
      .catch((error) => toast.error(errorMessage(error, 'Could not load course filters.')))
  }, [])

  const loadCourses = useCallback(async (nextLimit, append = false) => {
    const current = ++requestId.current
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const { data } = await api.get('/courses', {
        params: {
          q: debouncedQuery || undefined,
          platform: platform || undefined,
          category: category || undefined,
          difficulty: difficulty || undefined,
          price_type: priceType || undefined,
          verified_only: verifiedOnly || undefined,
          sort,
          limit: nextLimit,
          offset: 0,
        },
      })
      if (current !== requestId.current) return
      setCourses(data.items || [])
      setTotal(data.total || 0)
    } catch (error) {
      if (current === requestId.current) toast.error(errorMessage(error, 'Could not load the course catalogue.'))
    } finally {
      if (current === requestId.current) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [debouncedQuery, platform, category, difficulty, priceType, verifiedOnly, sort])

  useEffect(() => {
    setLimit(24)
    loadCourses(24)
  }, [loadCourses])

  async function openCourse(course) {
    setSelected(course)
    setRelated([])
    setDetailLoading(true)
    try {
      const { data } = await api.get(`/courses/${course.course_id}/related`, { params: { limit: 4 } })
      setRelated(data || [])
    } catch {
      setRelated([])
    } finally {
      setDetailLoading(false)
    }
  }

  async function markProgress(course, status) {
    setBusyId(course.course_id)
    try {
      await api.post('/progress/course', {
        course_id: course.course_id,
        status,
        progress_percent: status === 'completed' ? 100 : 50,
      })
      toast.success(status === 'completed' ? 'Course marked complete. Your roadmap updated.' : 'Course started.')
      if (selected?.course_id === course.course_id) setSelected({ ...selected })
    } catch (error) {
      toast.error(errorMessage(error, 'Could not update course progress.'))
    } finally {
      setBusyId('')
    }
  }

  function clearFilters() {
    setQuery('')
    setPlatform('')
    setCategory('')
    setDifficulty('')
    setPriceType('')
    setVerifiedOnly(false)
    setSort('recommended')
  }

  const activeFilters = useMemo(
    () => [platform, category, difficulty, priceType, verifiedOnly && 'verified', debouncedQuery].filter(Boolean).length,
    [platform, category, difficulty, priceType, verifiedOnly, debouncedQuery],
  )

  return (
    <>
      <PageHeader
        eyebrow="Course catalogue"
        title="Courses that close your gaps"
        description="Every entry comes from the stored catalogue. Verified direct pages are marked green; catalogue and search links ask you to confirm details."
        actions={
          <>
            <Link to="/skills" className="btn-secondary"><Sparkles className="h-4 w-4" /> See my gaps</Link>
            <Button variant="secondary" onClick={() => setShowFilters((value) => !value)} icon={Filter}>
              Filters{activeFilters ? ` (${activeFilters})` : ''}
            </Button>
          </>
        }
      />

      {recommendations.length ? (
        <section className="mb-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-bold text-slate-900">Recommended for your career goal</h2>
            <Badge tone="brand" className="ml-auto">{recommendations.length} courses</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {recommendations.map((recommendation) => (
              <div key={recommendation.course.course_id} className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/70 to-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-600">
                      {recommendation.course.platform} · {Math.round(recommendation.score)}% match
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm font-bold text-slate-900">{recommendation.course.title}</p>
                  </div>
                  <VerifiedBadge verified={recommendation.course.verified} linkType={recommendation.course.link_type} />
                </div>
                <p className="mt-1.5 line-clamp-2 text-[11px] text-slate-500">
                  {recommendation.reasons?.[0] || recommendation.course.description}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(recommendation.matched_skills || []).slice(0, 4).map((skill) => (
                    <span key={skill} className="chip border border-brand-100 bg-white text-brand-700">{pretty(skill)}</span>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button type="button" onClick={() => openCourse(recommendation.course)} className="text-[11px] font-semibold text-slate-500 hover:text-slate-800">Details</button>
                  <a
                    href={recommendation.course.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-800"
                  >
                    Open provider <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title, provider, category or description…"
              className="input pl-9"
            />
          </div>
          <Select value={sort} onChange={(event) => setSort(event.target.value)} className="sm:w-[220px]">
            {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
        </div>

        {showFilters ? (
          <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-5">
            <Select value={platform} onChange={(event) => setPlatform(event.target.value)}>
              <option value="">All platforms</option>
              {(filters?.platforms || []).map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
            <Select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">All categories</option>
              {(filters?.categories || []).map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
            </Select>
            <Select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
              <option value="">Any difficulty</option>
              {(filters?.difficulties || []).map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
            </Select>
            <Select value={priceType} onChange={(event) => setPriceType(event.target.value)}>
              <option value="">Any price</option>
              {(filters?.price_types || []).map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
            <div className="flex items-center gap-2">
              <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 text-xs text-slate-600">
                <input type="checkbox" checked={verifiedOnly} onChange={(event) => setVerifiedOnly(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
                Verified direct only
              </label>
              {activeFilters ? (
                <button type="button" onClick={clearFilters} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Clear filters">
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Card>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>{total} course{total === 1 ? '' : 's'} available</span>
        {filters?.counts ? (
          <>
            <span className="text-slate-300">·</span>
            <span>{filters.counts.verified_direct} verified direct</span>
            <span className="text-slate-300">·</span>
            <span>{filters.counts.free} free</span>
          </>
        ) : null}
        {activeFilters ? <Badge tone="brand" className="ml-auto">{activeFilters} active filter{activeFilters > 1 ? 's' : ''}</Badge> : null}
      </div>

      {loading ? (
        <Loading label="Loading course catalogue…" />
      ) : courses.length ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {courses.map((course) => (
              <CourseCard key={course.course_id} course={course} onOpen={openCourse} onProgress={markProgress} busyId={busyId} />
            ))}
          </div>
          {courses.length < total ? (
            <div className="mt-5 text-center">
              <Button
                variant="secondary"
                loading={loadingMore}
                onClick={() => {
                  const next = limit + 24
                  setLimit(next)
                  loadCourses(next, true)
                }}
              >
                Load more ({courses.length} of {total})
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="No courses match these filters"
          description="Try clearing a filter or searching for a broader skill such as Python, SQL or design."
          action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}
        />
      )}

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.title} description={selected ? `${selected.platform} · ${titleCase(selected.category)}` : ''} size="lg">
        {selected ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              <VerifiedBadge verified={selected.verified} linkType={selected.link_type} />
              <Badge tone="slate">{titleCase(selected.difficulty)}</Badge>
              <Badge tone={selected.price_type === 'Free' ? 'emerald' : 'slate'} icon={Tag}>
                {selected.price_type}{selected.price_usd ? ` · $${selected.price_usd}` : ''}
              </Badge>
              <Badge tone="slate" icon={Clock}>
                {selected.duration_hours ? `${Math.round(selected.duration_hours)} hours` : 'Duration n/a'}
                {selected.duration_is_estimate && selected.duration_hours ? ' (estimate)' : ''}
              </Badge>
              {selected.rating ? <Badge tone="amber" icon={Star}>{selected.rating} / 5</Badge> : null}
              {selected.certificate ? <Badge tone="violet" icon={GraduationCap}>Certificate</Badge> : null}
            </div>

            {!selected.verified || selected.link_type !== 'direct' ? (
              <Alert tone="warning" title="Verify before enrolling">
                {selected.verification_note || 'This link points to an official catalogue or search page, not a verified direct course page. Confirm the exact course, price and duration on the provider site.'}
              </Alert>
            ) : (
              <Alert tone="success" title="Verified direct course page">
                {selected.verification_note || 'The stored catalogue marks this as a direct course page.'}
              </Alert>
            )}

            <p className="text-sm leading-relaxed text-slate-600">{selected.description}</p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Skills covered</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(selected.skills || []).map((skill) => <span key={skill} className="chip border border-slate-200 bg-white text-slate-600">{pretty(skill)}</span>)}
                  {!selected.skills?.length ? <span className="text-xs text-slate-400">Not tagged</span> : null}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Prerequisites</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(selected.prerequisites || []).map((skill) => <span key={skill} className="chip border border-slate-200 bg-white text-slate-600">{pretty(skill)}</span>)}
                  {!selected.prerequisites?.length ? <span className="text-xs text-slate-400">None listed</span> : null}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Learning format</p>
                <p className="mt-1">{selected.learning_type} · {selected.language}</p>
                {selected.price_note ? <p className="mt-1 text-[11px] text-slate-400">{selected.price_note}</p> : null}
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Provider link</p>
                <a href={selected.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-flex items-center gap-1 font-semibold text-brand-600 hover:text-brand-800">
                  Open {selected.platform} <ExternalLink className="h-3 w-3" />
                </a>
                <p className="mt-1 break-all text-[10px] text-slate-400">{selected.url}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" icon={CheckCircle2} loading={busyId === selected.course_id} onClick={() => markProgress(selected, 'completed')}>
                Mark completed
              </Button>
              <Button size="sm" variant="secondary" icon={Play} onClick={() => markProgress(selected, 'in_progress')}>
                Start learning
              </Button>
              <a href={selected.url} target="_blank" rel="noopener noreferrer nofollow" className="btn-secondary">
                <ExternalLink className="h-4 w-4" /> Go to provider
              </a>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold text-slate-800">Related courses</p>
              {detailLoading ? (
                <div className="flex items-center gap-2 text-xs text-slate-400"><Spinner className="h-4 w-4" /> Finding related courses…</div>
              ) : related.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {related.map((course) => (
                    <button key={course.course_id} type="button" onClick={() => openCourse(course)} className="rounded-xl border border-slate-200 p-2.5 text-left hover:border-brand-200 hover:bg-slate-50">
                      <p className="line-clamp-1 text-xs font-semibold text-slate-800">{course.title}</p>
                      <p className="text-[10px] text-slate-400">{course.platform} · {titleCase(course.difficulty)}</p>
                    </button>
                  ))}
                </div>
              ) : <p className="text-xs text-slate-400">No related courses found.</p>}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  )
}
