import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownToLine, Check, ChevronDown, CircleHelp, FileText, Plus, Sparkles, Trash2, UserRound, X } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

type Experience = { role: string; company: string; dates: string; details: string }
type Education = { degree: string; school: string; dates: string }
type Resume = {
  name: string; role: string; email: string; phone: string; location: string; website: string
  summary: string; skills: string; experience: Experience[]; education: Education[]
}
type Template = 'classic' | 'atelier' | 'citrus' | 'editorial'
type ResumeSection = 'experience' | 'education' | 'skills'

const templates: { id: Template; label: string; note: string; color: string }[] = [
  { id: 'classic', label: 'The Standard', note: 'Clean & timeless', color: '#292c29' },
  { id: 'atelier', label: 'The Atelier', note: 'Soft & considered', color: '#607c68' },
  { id: 'citrus', label: 'The Current', note: 'Bright & confident', color: '#cf674c' },
  { id: 'editorial', label: 'The Editorial', note: 'A little more you', color: '#4d6691' },
]

const initialResume: Resume = {
  name: 'Alex Morgan', role: 'Product designer', email: 'alex.morgan@email.com', phone: '+1 (555) 013-4820', location: 'Brooklyn, NY', website: 'alexmorgan.design',
  summary: 'Curious product designer with 6+ years shaping thoughtful digital experiences. I bring clarity to complex problems and help teams turn good ideas into products people love to use.',
  skills: 'Product strategy, UX research, Interaction design, Prototyping, Figma, Design systems',
  experience: [
    { role: 'Senior Product Designer', company: 'Northstar Studio', dates: '2022 — Present', details: 'Led end-to-end design for a new analytics platform, helping 18k+ customers make faster, more confident decisions. Built a shared design system adopted across four product teams.' },
    { role: 'Product Designer', company: 'Goodwell Digital', dates: '2019 — 2022', details: 'Partnered with product and engineering to simplify onboarding, increasing activation by 24%. Ran weekly customer interviews and translated insights into shippable improvements.' },
  ],
  education: [{ degree: 'BFA, Communication Design', school: 'Rhode Island School of Design', dates: '2015 — 2019' }],
}

function App() {
  const [resume, setResume] = useState<Resume>(initialResume)
  const [visibleSections, setVisibleSections] = useState<Record<ResumeSection, boolean>>({ experience: true, education: true, skills: true })
  const [template, setTemplate] = useState<Template>('classic')
  const [activeTab, setActiveTab] = useState<'content' | 'design'>('content')
  const [modalOpen, setModalOpen] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authMode, setAuthMode] = useState<'email' | 'code'>(() => sessionStorage.getItem('folio-otp-sent') === 'true' ? 'code' : 'email')
  const [authEmail, setAuthEmail] = useState(() => sessionStorage.getItem('folio-pending-email') ?? '')
  const [authCode, setAuthCode] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [verificationBusy, setVerificationBusy] = useState(false)
  const [photoUrl, setPhotoUrl] = useState('')
  const [photoMode, setPhotoMode] = useState<'without' | 'with'>('without')
  const [photoError, setPhotoError] = useState('')
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [cloudReady, setCloudReady] = useState(false)
  const [cloudStatus, setCloudStatus] = useState('Connecting to Supabase…')
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const photoInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) setCloudStatus('Could not connect to Supabase')
      setAuthUser(data.session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCloudReady(false)
      setAuthUser(session?.user ?? null)
      setAuthError('')
      setModalOpen(false)
      if (session?.user) {
        sessionStorage.removeItem('folio-pending-email')
        sessionStorage.removeItem('folio-otp-sent')
        sessionStorage.setItem('folio-download-after-auth', 'true')
        setAuthEmail('')
        setAuthCode('')
        setAuthMode('email')
      }
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (authEmail) sessionStorage.setItem('folio-pending-email', authEmail)
    else sessionStorage.removeItem('folio-pending-email')
    if (authMode === 'code' && authEmail) sessionStorage.setItem('folio-otp-sent', 'true')
    else sessionStorage.removeItem('folio-otp-sent')
  }, [authEmail, authMode])

  useEffect(() => {
    if (!authUser) {
      setCloudReady(true)
      setCloudStatus('Sign in to sync your resume')
      setPhotoPath(null)
      return
    }
    let active = true
    setCloudReady(false)
    setCloudStatus('Loading your resume…')
    void (async () => {
      const { data, error } = await supabase.from('resumes').select('resume, template, visible_sections, photo_mode, photo_path').eq('user_id', authUser.id).maybeSingle()
      if (!active) return
      if (error) {
        setCloudStatus('Could not load your resume')
        setAuthError(`${error.message} Check that you ran the Supabase SQL setup.`)
        setCloudReady(true)
        return
      }
      if (data) {
        if (data.resume && typeof data.resume === 'object') setResume(data.resume as Resume)
        if (data.template && templates.some((item) => item.id === data.template)) setTemplate(data.template as Template)
        if (data.visible_sections && typeof data.visible_sections === 'object') setVisibleSections(data.visible_sections as Record<ResumeSection, boolean>)
        if (data.photo_mode === 'with' || data.photo_mode === 'without') setPhotoMode(data.photo_mode)
        setPhotoPath(data.photo_path)
        if (data.photo_path) {
          const { data: signedPhoto, error: photoLoadError } = await supabase.storage.from('profile-photos').createSignedUrl(data.photo_path, 3600)
          if (!active) return
          if (photoLoadError) setPhotoError('Could not load your saved profile photo.')
          else setPhotoUrl(signedPhoto.signedUrl)
        } else {
          setPhotoUrl('')
        }
      } else {
        setPhotoPath(null)
        setPhotoUrl('')
      }
      if (active) {
        setAuthError('')
        setCloudStatus('Resume synced')
        setCloudReady(true)
        if (sessionStorage.getItem('folio-download-after-auth') === 'true') {
          sessionStorage.removeItem('folio-download-after-auth')
          window.setTimeout(() => window.print(), 300)
        }
      }
    })()
    return () => { active = false }
  }, [authUser])

  useEffect(() => {
    if (!authUser || !cloudReady) return
    const timeout = window.setTimeout(() => {
      void (async () => {
        setCloudStatus('Saving…')
        let savedPhotoPath = photoPath
        if (photoUrl.startsWith('data:image/')) {
          const imageBlob = await fetch(photoUrl).then((response) => response.blob())
          const extension = imageBlob.type === 'image/jpeg' ? 'jpg' : imageBlob.type === 'image/webp' ? 'webp' : 'png'
          savedPhotoPath = `${authUser.id}/profile.${extension}`
          const { error: uploadError } = await supabase.storage.from('profile-photos').upload(savedPhotoPath, imageBlob, { upsert: true, contentType: imageBlob.type })
          if (uploadError) {
            setCloudStatus('Photo upload failed')
            setPhotoError(uploadError.message)
            return
          }
          const { data: signedPhoto, error: signedPhotoError } = await supabase.storage.from('profile-photos').createSignedUrl(savedPhotoPath, 3600)
          if (signedPhotoError) {
            setCloudStatus('Could not prepare profile photo')
            return
          }
          setPhotoUrl(signedPhoto.signedUrl)
          setPhotoPath(savedPhotoPath)
        }
        if (!photoUrl && photoPath) {
          const { error: deleteError } = await supabase.storage.from('profile-photos').remove([photoPath])
          if (deleteError) setPhotoError('Photo removed from this resume, but could not be deleted from storage.')
          savedPhotoPath = null
          setPhotoPath(null)
        }
        const { error } = await supabase.from('resumes').upsert({
          user_id: authUser.id,
          resume,
          template,
          visible_sections: visibleSections,
          photo_mode: photoMode,
          photo_path: savedPhotoPath,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        if (error) setCloudStatus('Save failed')
        else setCloudStatus('Resume synced')
      })()
    }, 700)
    return () => window.clearTimeout(timeout)
  }, [authUser, cloudReady, resume, template, visibleSections, photoMode, photoUrl, photoPath])

  const skills = useMemo(() => resume.skills.split(',').map((skill) => skill.trim()).filter(Boolean), [resume.skills])
  const update = (key: keyof Resume, value: string) => setResume((current) => ({ ...current, [key]: value }))
  const toggleSection = (section: ResumeSection, visible: boolean) => setVisibleSections((current) => ({ ...current, [section]: visible }))
  const updateEntry = (key: 'experience' | 'education', index: number, field: string, value: string) => {
    setResume((current) => key === 'experience'
      ? { ...current, experience: current.experience.map((entry, entryIndex) => entryIndex === index ? { ...entry, [field]: value } : entry) }
      : { ...current, education: current.education.map((entry, entryIndex) => entryIndex === index ? { ...entry, [field]: value } : entry) })
  }
  const handlePhotoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    if (!file) return
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setPhotoError('Choose a JPG, PNG or WEBP image.')
      event.currentTarget.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Choose an image smaller than 5 MB.')
      event.currentTarget.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoUrl(reader.result)
        setPhotoError('')
      }
    }
    reader.onerror = () => setPhotoError('This image could not be read. Please try another file.')
    reader.readAsDataURL(file)
  }
  const removePhoto = () => {
    setPhotoUrl('')
    setPhotoError('')
    if (photoInput.current) photoInput.current.value = ''
  }
  const sendEmailCode = async () => {
    setAuthError('')
    setAuthNotice('')
    const email = authEmail.trim().toLowerCase()
    if (!/^[^\s@]+@gmail\.com$/.test(email)) {
      setAuthError('Enter a valid Gmail address.')
      return
    }
    setVerificationBusy(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
      if (error) {
        const deliveryHint = error.status === 429
          ? 'Supabase rate-limited email sending. Wait a minute before trying again.'
          : 'Check that Supabase Email Auth is enabled and configured to send OTP tokens.'
        setAuthError(`${error.message} ${deliveryHint}`)
      } else {
        setAuthEmail(email)
        setAuthCode('')
        setAuthMode('code')
        setAuthNotice('Supabase accepted the request. Check your Gmail inbox and spam folder for the six-digit code.')
      }
    } catch {
      setAuthError('Could not reach Supabase Auth. Check your connection and try again.')
    } finally {
      setVerificationBusy(false)
    }
  }
  const verifyEmailCode = async () => {
    setAuthError('')
    setAuthNotice('')
    const email = authEmail.trim().toLowerCase()
    if (!/^\d{6}$/.test(authCode)) {
      setAuthError('Enter the six-digit code sent to your Gmail inbox.')
      return
    }
    setVerificationBusy(true)
    sessionStorage.setItem('folio-download-after-auth', 'true')
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: authCode, type: 'email' })
      if (error) {
        sessionStorage.removeItem('folio-download-after-auth')
        setAuthError(`${error.message} Check that the code is current, then request a new one if it expired.`)
      }
    } catch {
      sessionStorage.removeItem('folio-download-after-auth')
      setAuthError('Could not reach Supabase Auth. Check your connection and try again.')
    } finally {
      setVerificationBusy(false)
    }
  }
  const changeVerificationEmail = () => {
    setAuthError('')
    setAuthNotice('')
    setAuthMode('email')
    setAuthCode('')
  }
  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) setAuthError(error.message)
  }
  const startDownload = () => {
    if (authUser) window.print()
    else { setAuthError(''); setModalOpen(true) }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Folio home">
          <span className="brand-mark">
            <FileText size={17} strokeWidth={2.2} />
          </span>
          <span>
            folio<span className="brand-period">.</span>
          </span>
        </a>
        <div className="topbar-center">
          <span className="document-name">Untitled resume</span>
          <span className="saved-state">
            <span /> {cloudStatus}
          </span>
        </div>
        <div className="topbar-actions">
          {authUser && (
            <button
              className="account-button"
              onClick={signOut}
              title={`Sign out ${authUser.email ?? ""}`}
              aria-label="Sign out"
            >
              <UserRound size={16} />
            </button>
          )}
          <button className="help-button" aria-label="Help">
            <CircleHelp size={18} />
          </button>
          <button className="download-button" onClick={startDownload}>
            <ArrowDownToLine size={16} /> Download PDF
          </button>
        </div>
      </header>

      <main className="workspace" id="top">
        <aside className="editor-pane">
          <div className="editor-heading">
            <div>
              <span className="eyebrow">YOUR NEXT CHAPTER</span>
              <h1>Make it yours.</h1>
            </div>
            <span className="avatar">
              <UserRound size={16} />
            </span>
          </div>
          <div className="tabs" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === "content"}
              className={activeTab === "content" ? "selected" : ""}
              onClick={() => setActiveTab("content")}
            >
              Content
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "design"}
              className={activeTab === "design" ? "selected" : ""}
              onClick={() => setActiveTab("design")}
            >
              Design
            </button>
          </div>
          {authError && !modalOpen && (
            <div className="cloud-error-banner" role="status">
              {authError}
            </div>
          )}
          {activeTab === "content" ? (
            <div className="form-scroll">
              <section className="form-section">
                <div className="section-title">
                  <div>
                    <span className="section-number">01</span>
                    <h2>About you</h2>
                  </div>
                  <ChevronDown size={16} />
                </div>
                <div className="field-grid">
                  <Field
                    label="Full name"
                    value={resume.name}
                    onChange={(v) => update("name", v)}
                  />
                  <Field
                    label="Professional title"
                    value={resume.role}
                    onChange={(v) => update("role", v)}
                  />
                </div>
                <div className="field-grid">
                  <Field
                    label="Email address"
                    value={resume.email}
                    onChange={(v) => update("email", v)}
                  />
                  <Field
                    label="Phone number"
                    value={resume.phone}
                    onChange={(v) => update("phone", v)}
                  />
                </div>
                <div className="field-grid">
                  <Field
                    label="Location"
                    value={resume.location}
                    onChange={(v) => update("location", v)}
                  />
                  <Field
                    label="Website"
                    value={resume.website}
                    onChange={(v) => update("website", v)}
                  />
                </div>
                <label className="field-label">
                  Profile
                  <span className="char-count">
                    {resume.summary.length}/500
                  </span>
                  <textarea
                    maxLength={500}
                    rows={4}
                    value={resume.summary}
                    onChange={(e) => update("summary", e.target.value)}
                  />
                </label>
              </section>
              {visibleSections.experience && (
                <section className="form-section">
                  <div className="section-title">
                    <div>
                      <span className="section-number">02</span>
                      <h2>Experience</h2>
                    </div>
                    <div className="section-actions">
                      <button
                        className="icon-quiet"
                        aria-label="Add experience"
                        title="Add experience"
                        onClick={() =>
                          setResume((r) => ({
                            ...r,
                            experience: [
                              ...r.experience,
                              { role: "", company: "", dates: "", details: "" },
                            ],
                          }))
                        }
                      >
                        <Plus size={17} />
                      </button>
                      <button
                        className="icon-quiet danger"
                        aria-label="Remove experience section"
                        title="Remove section"
                        onClick={() => toggleSection("experience", false)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  {resume.experience.map((entry, i) => (
                    <div className="entry-block" key={`experience-${i}`}>
                      <div className="entry-top">
                        <span>POSITION {String(i + 1).padStart(2, "0")}</span>
                        <button
                          className="icon-quiet danger"
                          aria-label="Remove experience"
                          onClick={() =>
                            setResume((r) => ({
                              ...r,
                              experience: r.experience.filter(
                                (_, j) => j !== i,
                              ),
                            }))
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <div className="field-grid">
                        <Field
                          label="Job title"
                          value={entry.role}
                          onChange={(v) =>
                            updateEntry("experience", i, "role", v)
                          }
                        />
                        <Field
                          label="Company"
                          value={entry.company}
                          onChange={(v) =>
                            updateEntry("experience", i, "company", v)
                          }
                        />
                      </div>
                      <Field
                        label="Dates"
                        value={entry.dates}
                        onChange={(v) =>
                          updateEntry("experience", i, "dates", v)
                        }
                      />
                      <label className="field-label">
                        What you did
                        <textarea
                          rows={3}
                          value={entry.details}
                          onChange={(e) =>
                            updateEntry(
                              "experience",
                              i,
                              "details",
                              e.target.value,
                            )
                          }
                        />
                      </label>
                    </div>
                  ))}
                </section>
              )}
              {visibleSections.education && (
                <section className="form-section">
                  <div className="section-title">
                    <div>
                      <span className="section-number">03</span>
                      <h2>Education</h2>
                    </div>
                    <div className="section-actions">
                      <button
                        className="icon-quiet"
                        aria-label="Add education"
                        title="Add education"
                        onClick={() =>
                          setResume((r) => ({
                            ...r,
                            education: [
                              ...r.education,
                              { degree: "", school: "", dates: "" },
                            ],
                          }))
                        }
                      >
                        <Plus size={17} />
                      </button>
                      <button
                        className="icon-quiet danger"
                        aria-label="Remove education section"
                        title="Remove section"
                        onClick={() => toggleSection("education", false)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  {resume.education.map((entry, i) => (
                    <div className="entry-block" key={`education-${i}`}>
                      <div className="entry-top">
                        <span>EDUCATION {String(i + 1).padStart(2, "0")}</span>
                        <button
                          className="icon-quiet danger"
                          aria-label="Remove education"
                          onClick={() =>
                            setResume((r) => ({
                              ...r,
                              education: r.education.filter((_, j) => j !== i),
                            }))
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <Field
                        label="Degree / qualification"
                        value={entry.degree}
                        onChange={(v) =>
                          updateEntry("education", i, "degree", v)
                        }
                      />
                      <div className="field-grid">
                        <Field
                          label="School"
                          value={entry.school}
                          onChange={(v) =>
                            updateEntry("education", i, "school", v)
                          }
                        />
                        <Field
                          label="Dates"
                          value={entry.dates}
                          onChange={(v) =>
                            updateEntry("education", i, "dates", v)
                          }
                        />
                      </div>
                    </div>
                  ))}
                </section>
              )}
              {visibleSections.skills && (
                <section className="form-section last-section">
                  <div className="section-title">
                    <div>
                      <span className="section-number">04</span>
                      <h2>Skills</h2>
                    </div>
                    <button
                      className="icon-quiet danger"
                      aria-label="Remove skills section"
                      title="Remove section"
                      onClick={() => toggleSection("skills", false)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <label className="field-label">
                    Separate each skill with a comma
                    <textarea
                      rows={3}
                      value={resume.skills}
                      onChange={(e) => update("skills", e.target.value)}
                    />
                  </label>
                </section>
              )}
              {Object.entries({
                experience: "Experience",
                education: "Education",
                skills: "Skills",
              }).some(
                ([section]) => !visibleSections[section as ResumeSection],
              ) && (
                <section
                  className="add-section-panel"
                  aria-label="Add resume sections"
                >
                  <span className="eyebrow">ADD A SECTION</span>
                  <div className="add-section-actions">
                    {(
                      Object.entries({
                        experience: "Experience",
                        education: "Education",
                        skills: "Skills",
                      }) as [ResumeSection, string][]
                    )
                      .filter(([section]) => !visibleSections[section])
                      .map(([section, label]) => (
                        <button
                          key={section}
                          className="restore-section-button"
                          onClick={() => toggleSection(section, true)}
                        >
                          <Plus size={14} /> {label}
                        </button>
                      ))}
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div className="design-panel">
              <span className="eyebrow">CHOOSE YOUR LOOK</span>
              <h2>A first impression, in a page.</h2>
              <p>Every detail updates as you build.</p>
              <div
                className="photo-mode-control"
                role="group"
                aria-label="Photograph layout"
              >
                <button
                  className={`photo-mode-option ${photoMode === "without" ? "active" : ""}`}
                  aria-pressed={photoMode === "without"}
                  onClick={() => setPhotoMode("without")}
                >
                  <span className="mode-option-icon">
                    <FileText size={17} />
                  </span>
                  <span>
                    <strong>Without photograph</strong>
                    <small>Clean, photo-free layout</small>
                  </span>
                  {photoMode === "without" && (
                    <Check size={14} className="mode-check" />
                  )}
                </button>
                <button
                  className={`photo-mode-option ${photoMode === "with" ? "active" : ""}`}
                  aria-pressed={photoMode === "with"}
                  onClick={() => setPhotoMode("with")}
                >
                  <span className="mode-option-icon">
                    <UserRound size={17} />
                  </span>
                  <span>
                    <strong>With photograph</strong>
                    <small>Add a passport-size portrait</small>
                  </span>
                  {photoMode === "with" && (
                    <Check size={14} className="mode-check" />
                  )}
                </button>
              </div>
              {photoMode === "with" && (
                <div className="photo-editor photo-editor-design">
                  {photoUrl && (
                    <img
                      className="photo-thumbnail"
                      src={photoUrl}
                      alt="Selected profile"
                    />
                  )}
                  <div className="photo-editor-copy">
                    <strong>Passport-size photo</strong>
                    <small>
                      Portrait crop, 35 × 45 mm · JPG, PNG or WEBP · up to 5 MB
                    </small>
                    <div className="photo-actions">
                      <button
                        type="button"
                        onClick={() => photoInput.current?.click()}
                      >
                        {photoUrl ? "Change photo" : "Upload photo"}
                      </button>
                      {photoUrl && (
                        <button
                          type="button"
                          className="photo-remove"
                          onClick={removePhoto}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    ref={photoInput}
                    className="hidden-file-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoUpload}
                  />
                  {photoError && (
                    <p className="photo-error" role="alert">
                      {photoError}
                    </p>
                  )}
                </div>
              )}
              <div className="template-grid">
                {templates.map((item) => (
                  <button
                    key={item.id}
                    className={`template-option ${template === item.id ? "active" : ""}`}
                    onClick={() => setTemplate(item.id)}
                    aria-pressed={template === item.id}
                  >
                    <span className={`template-thumb thumb-${item.id}`}>
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                    <span className="template-meta">
                      <strong>{item.label}</strong>
                      <small>{item.note}</small>
                    </span>
                    {template === item.id && (
                      <span className="template-check">
                        <Check size={13} />
                      </span>
                    )}
                    <span
                      className="template-swatch"
                      style={{ background: item.color }}
                    />
                  </button>
                ))}
              </div>
              <div className="design-note">
                <Sparkles size={16} />
                <span>Designed to look great on screen and on paper.</span>
              </div>
            </div>
          )}
        </aside>

        <section className="preview-pane" aria-label="Live resume preview">
          <div className="preview-toolbar">
            <div className="preview-label">
              <span className="live-dot" /> LIVE PREVIEW
            </div>
            <div className="page-indicator">
              A4 <span>·</span> 1 page
            </div>
          </div>
          <div className="paper-wrap">
            <article
              className={`resume-paper resume-${template}`}
              id="resume-paper"
            >
              <div className="resume-header">
                <div className="resume-name-block">
                  <h2>{resume.name || "Your Name"}</h2>
                  <p className="resume-role">
                    {resume.role || "Your professional title"}
                  </p>
                </div>
                <div className="resume-header-right">
                  <div className="contact-list">
                    {[
                      resume.email,
                      resume.phone,
                      resume.location,
                      resume.website,
                    ]
                      .filter(Boolean)
                      .map((item) => (
                        <span key={item}>{item}</span>
                      ))}
                  </div>
                  {photoUrl && (
                    <img
                      className="resume-photo"
                      src={photoUrl}
                      alt={`${resume.name || "Profile"} portrait`}
                    />
                  )}
                </div>
              </div>
              <section className="resume-section">
                <h3>Profile</h3>
                <p>
                  {resume.summary ||
                    "A short introduction about your professional experience and what you bring to the table."}
                </p>
              </section>
              {visibleSections.experience && (
                <section className="resume-section">
                  <h3>Experience</h3>
                  {resume.experience.length ? (
                    resume.experience.map((entry, i) => (
                      <div className="resume-entry" key={`preview-exp-${i}`}>
                        <div className="resume-entry-heading">
                          <div>
                            <strong>{entry.role || "Job title"}</strong>
                            <span>{entry.company || "Company"}</span>
                          </div>
                          <time>{entry.dates}</time>
                        </div>
                        {entry.details && <p>{entry.details}</p>}
                      </div>
                    ))
                  ) : (
                    <p className="empty-hint">
                      Add your experience to bring this section to life.
                    </p>
                  )}
                </section>
              )}
              {visibleSections.education && (
                <section className="resume-section">
                  <h3>Education</h3>
                  {resume.education.length ? (
                    resume.education.map((entry, i) => (
                      <div
                        className="resume-entry resume-education"
                        key={`preview-edu-${i}`}
                      >
                        <div className="resume-entry-heading">
                          <div>
                            <strong>
                              {entry.degree || "Degree or qualification"}
                            </strong>
                            <span>
                              {entry.school || "School or institution"}
                            </span>
                          </div>
                          <time>{entry.dates}</time>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="empty-hint">Add your education.</p>
                  )}
                </section>
              )}
              {visibleSections.skills && skills.length > 0 && (
                <section className="resume-section">
                  <h3>Skills</h3>
                  <div className="skill-list">
                    {skills.map((skill) => (
                      <span key={skill}>{skill}</span>
                    ))}
                  </div>
                </section>
              )}
              <div className="paper-footer">
                <span>
                  FOLIO <b>·</b> {resume.name || "YOUR NAME"}
                </span>
                <span>CURRICULUM VITAE</span>
              </div>
            </article>
          </div>
          <div className="preview-footnote">
            <span>✳</span> Looking good. Keep going.
          </div>
        </section>
      </main>

      {modalOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <section
            className="verify-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="verify-title"
          >
            <button
              className="modal-close"
              onClick={() => setModalOpen(false)}
              aria-label="Close"
            >
              <X size={19} />
            </button>
            <div className="verify-icon">
              <ArrowDownToLine size={20} />
            </div>
            <span className="eyebrow">SAVE & DOWNLOAD</span>
            <h2 id="verify-title">
              {authMode === "email" ? "Verify your Gmail." : "Check your inbox."}
            </h2>
            <p>{authMode === "email" ? "Enter your Gmail address and we’ll send a one-time verification code." : `Enter the six-digit code sent to ${authEmail}.`}</p>
            <form
              className="email-verification-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (authMode === "email") void sendEmailCode();
                else void verifyEmailCode();
              }}
            >
              {authMode === "email" ? <label className="field-label">
                Gmail address
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@gmail.com"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  required
                />
              </label> : <label className="field-label">
                6-digit verification code
                <input
                  className="otp-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  placeholder="000000"
                  value={authCode}
                  onChange={(event) => setAuthCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                />
              </label>}
              <button
                className="oauth-button"
                type="submit"
                disabled={verificationBusy}
              >
                {verificationBusy ? "Please wait…" : authMode === "email" ? "Send verification code" : "Verify and continue"}
              </button>
            </form>
            {authMode === "code" && <div className="mail-delivery-note">If no email arrives, check Spam. Supabase’s built-in email sender is limited; configure SMTP for reliable delivery. Ensure the Supabase email template contains <code>{"{{ .Token }}"}</code>.</div>}
            {authMode === "code" && <div className="otp-actions">
              <button className="resend-code-button" type="button" onClick={() => void sendEmailCode()} disabled={verificationBusy}>Send a new code</button>
              <button className="resend-code-button" type="button" onClick={changeVerificationEmail} disabled={verificationBusy}>Change Gmail address</button>
            </div>}
            {authError && (
              <p className="auth-error" role="alert">
                {authError}
              </p>
            )}
            {authNotice && <p className="auth-notice" role="status">{authNotice}</p>}
            <div className="privacy-note">
              <Check size={14} /> Your account and resume are secured by Supabase.
            </div>
            <button
              className="cancel-button"
              onClick={() => setModalOpen(false)}
            >
              Not now
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="field-label">{label}<input value={value} onChange={(e) => onChange(e.target.value)} /></label>
}

export default App