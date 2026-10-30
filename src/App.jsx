import React, { useEffect, useMemo, useState } from "react";
import Icon from "./components/Icon.jsx";
import { CATEGORIES, LEVELS, METHODS, createId, normalizeSkillName } from "./data.js";
import { clearSession, hashPassword, loadDatabase, loadSession, saveDatabase, saveSession } from "./storage.js";

const ROUTES = ["home", "login", "register", "dashboard", "explore", "offer", "learn", "matches", "exchanges", "profile", "community"];
const PRIVATE_ROUTES = new Set(["dashboard", "offer", "learn", "matches", "exchanges", "profile"]);
const EMPTY_SKILL = { name: "", category: CATEGORIES[0], description: "", level: "Intermediate", preferences: "Either works", availability: "" };
const EMPTY_LEARNING = { name: "", category: CATEGORIES[0], level: "Beginner", goals: "", description: "", method: "Either works" };

function currentRoute() {
  const route = window.location.hash.replace(/^#\/?/, "").split("/")[0];
  return ROUTES.includes(route) ? route : "home";
}

function initials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function dateLabel(date) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(date));
}

function categoryColor(category) {
  const colors = {
    Design: "purple",
    Technology: "blue",
    Media: "orange",
    Communication: "green",
    Business: "teal",
    Languages: "pink",
    Academics: "gold",
    Other: "gray",
  };
  return colors[category] || "gray";
}

function Badge({ children, tone = "gray" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function Avatar({ name, size = "normal" }) {
  return <span className={`avatar avatar-${size}`} aria-hidden="true">{initials(name)}</span>;
}

function EmptyState({ icon = "search", title, children, action }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon name={icon} size={22} /></span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}

function Field({ label, children, hint, className = "" }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

function Modal({ title, children, onClose, wide = false }) {
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog"><Icon name="close" /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

function App() {
  const [database, setDatabase] = useState(() => loadDatabase());
  const [studentId, setStudentId] = useState(() => loadSession());
  const [route, setRoute] = useState(currentRoute);
  const [notice, setNotice] = useState(null);
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [profileTarget, setProfileTarget] = useState(null);
  const [requestTarget, setRequestTarget] = useState(null);
  const [editingSkill, setEditingSkill] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [exchangeFilter, setExchangeFilter] = useState("All");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const student = database.profiles.find((profile) => profile.id === studentId) || null;

  useEffect(() => {
    function onHashChange() {
      const next = currentRoute();
      if (PRIVATE_ROUTES.has(next) && !studentId) {
        window.location.hash = "login";
        setRoute("login");
        setNotice({ type: "info", text: "Sign in to open your student workspace." });
        return;
      }
      setRoute(next);
      setMobileNavOpen(false);
      setAuthError("");
    }
    window.addEventListener("hashchange", onHashChange);
    if (PRIVATE_ROUTES.has(currentRoute()) && !studentId) {
      window.location.hash = "login";
      setRoute("login");
    }
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [studentId]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const skills = database.skills;
  const learningRequests = database.learningRequests;
  const exchanges = database.exchanges;
  const ownedSkills = skills.filter((skill) => skill.studentId === studentId);
  const ownedLearningRequests = learningRequests.filter((request) => request.studentId === studentId);

  function navigate(nextRoute) {
    if (PRIVATE_ROUTES.has(nextRoute) && !studentId) {
      setNotice({ type: "info", text: "Sign in to open your student workspace." });
      nextRoute = "login";
    }
    if (!ROUTES.includes(nextRoute)) return;
    if (currentRoute() === nextRoute) setRoute(nextRoute);
    else window.location.hash = nextRoute;
    setMobileNavOpen(false);
    setSearch("");
    setCategoryFilter("");
    setLevelFilter("");
  }

  function commit(nextDatabase, successMessage) {
    try {
      saveDatabase(nextDatabase);
      setDatabase(nextDatabase);
      if (successMessage) setNotice({ type: "success", text: successMessage });
      return true;
    } catch (error) {
      setNotice({ type: "error", text: error.message });
      return false;
    }
  }

  function updateProfile(updatedProfile) {
    const next = {
      ...database,
      profiles: database.profiles.map((profile) => profile.id === updatedProfile.id ? updatedProfile : profile),
    };
    return commit(next, "Your profile has been updated.");
  }

  async function handleRegister(event) {
    event.preventDefault();
    setAuthError("");
    setAuthBusy(true);
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    const college = String(form.get("college") || "").trim();
    const department = String(form.get("department") || "").trim();
    const year = String(form.get("year") || "");
    if (name.length < 2 || !email || password.length < 8 || !college || !department || !year) {
      setAuthError("Complete each field. Passwords must be at least 8 characters.");
      setAuthBusy(false);
      return;
    }
    if (database.profiles.some((profile) => profile.email.toLowerCase() === email)) {
      setAuthError("That email already has a profile. Try signing in instead.");
      setAuthBusy(false);
      return;
    }

    try {
      const id = createId("student");
      const salt = crypto.randomUUID();
      const passwordHash = await hashPassword(password, salt);
      const profile = {
        id, name, email, college, department, year,
        introduction: "",
        contact: "Connect through a skill request",
        joinedAt: new Date().toISOString(),
      };
      const next = {
        ...database,
        profiles: [...database.profiles, profile],
        credentials: [...database.credentials, { studentId: id, email, salt, passwordHash }],
      };
      if (commit(next, `Welcome to SkillSwap, ${name.split(" ")[0]}.`)) {
        saveSession(id);
        setStudentId(id);
        window.location.hash = "dashboard";
        setRoute("dashboard");
      }
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setAuthError("");
    setAuthBusy(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    try {
      const credential = database.credentials.find((entry) => entry.email === email);
      if (!credential || (await hashPassword(password, credential.salt)) !== credential.passwordHash) {
        setAuthError("Email or password is incorrect.");
        return;
      }
      saveSession(credential.studentId);
      setStudentId(credential.studentId);
      setNotice({ type: "success", text: "You’re signed in. Welcome back." });
      window.location.hash = "dashboard";
      setRoute("dashboard");
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  }

  function enterDemo() {
    try {
      saveSession("student-1");
      setStudentId("student-1");
      setNotice({ type: "success", text: "Demo student account opened. Sample records are labeled in the workspace." });
      window.location.hash = "dashboard";
      setRoute("dashboard");
    } catch (error) {
      setAuthError(error.message);
    }
  }

  function logout() {
    try {
      clearSession();
      setStudentId(null);
      setProfileTarget(null);
      navigate("home");
      setNotice({ type: "success", text: "You’ve signed out." });
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    }
  }

  function saveSkill(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      name: String(form.get("name") || "").trim(),
      category: String(form.get("category") || ""),
      description: String(form.get("description") || "").trim(),
      level: String(form.get("level") || ""),
      preferences: String(form.get("preferences") || ""),
      availability: String(form.get("availability") || "").trim(),
    };
    if (!input.name || input.name.length > 70 || !input.description || input.description.length < 15 || !input.availability) {
      setNotice({ type: "error", text: "Add a skill name, a description of at least 15 characters, and your availability." });
      return;
    }
    const duplicate = skills.some((skill) =>
      skill.studentId === studentId &&
      normalizeSkillName(skill.name) === normalizeSkillName(input.name) &&
      skill.id !== editingSkill?.id
    );
    if (duplicate) {
      setNotice({ type: "error", text: "You already have a listing for that skill. Edit your existing listing instead." });
      return;
    }
    const nextSkill = {
      ...input,
      id: editingSkill?.id || createId("skill"),
      studentId,
      createdAt: editingSkill?.createdAt || new Date().toISOString(),
    };
    const next = {
      ...database,
      skills: editingSkill
        ? database.skills.map((skill) => skill.id === editingSkill.id ? nextSkill : skill)
        : [nextSkill, ...database.skills],
    };
    if (commit(next, editingSkill ? "Skill listing updated." : "Your skill is now listed for students to discover.")) {
      setEditingSkill(null);
      event.currentTarget.reset();
    }
  }

  function deleteSkill(skill) {
    if (!window.confirm(`Delete your “${skill.name}” skill listing? Existing exchange requests will remain in your history.`)) return;
    const next = { ...database, skills: database.skills.filter((item) => item.id !== skill.id) };
    commit(next, "Skill listing removed.");
  }

  function saveLearningRequest(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const request = {
      id: createId("learn"),
      studentId,
      name: String(form.get("name") || "").trim(),
      category: String(form.get("category") || ""),
      level: String(form.get("level") || ""),
      goals: String(form.get("goals") || "").trim(),
      description: String(form.get("description") || "").trim(),
      method: String(form.get("method") || ""),
      createdAt: new Date().toISOString(),
    };
    if (!request.name || request.name.length > 70 || request.goals.length < 10 || request.description.length < 15) {
      setNotice({ type: "error", text: "Add the skill, a learning goal of at least 10 characters, and a description of at least 15 characters." });
      return;
    }
    const duplicate = learningRequests.some((item) =>
      item.studentId === studentId && normalizeSkillName(item.name) === normalizeSkillName(request.name)
    );
    if (duplicate) {
      setNotice({ type: "error", text: "You already have an active learning request for that skill." });
      return;
    }
    if (commit({ ...database, learningRequests: [request, ...database.learningRequests] }, "Your learning request is now visible to the community.")) {
      event.currentTarget.reset();
    }
  }

  function deleteLearningRequest(request) {
    if (!window.confirm(`Remove your request to learn ${request.name}?`)) return;
    commit({
      ...database,
      learningRequests: database.learningRequests.filter((item) => item.id !== request.id),
    }, "Learning request removed.");
  }

  function createExchange(skill, message) {
    if (!studentId) {
      navigate("login");
      return;
    }
    if (!skill || skill.studentId === studentId) {
      setNotice({ type: "error", text: "You can’t request your own skill listing." });
      return;
    }
    const duplicate = exchanges.some((exchange) =>
      exchange.skillId === skill.id &&
      exchange.fromId === studentId &&
      ["pending", "accepted"].includes(exchange.status)
    );
    if (duplicate) {
      setNotice({ type: "info", text: "You already have an active request for this skill." });
      setRequestTarget(null);
      return;
    }
    const exchange = {
      id: createId("exchange"),
      skillId: skill.id,
      skillName: skill.name,
      fromId: studentId,
      toId: skill.studentId,
      message: message.trim(),
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    if (commit({ ...database, exchanges: [exchange, ...database.exchanges] }, `Request sent to ${database.profiles.find((profile) => profile.id === skill.studentId)?.name || "the student"}.`)) {
      setRequestTarget(null);
    }
  }

  function requestAssistance(learningRequest, offeredSkill) {
    if (offeredSkill.studentId === learningRequest.studentId) return;
    const alreadySent = exchanges.some((exchange) =>
      exchange.fromId === studentId && exchange.toId === learningRequest.studentId &&
      exchange.skillId === offeredSkill.id && ["pending", "accepted"].includes(exchange.status)
    );
    if (alreadySent) {
      setNotice({ type: "info", text: "You already have an active exchange request with this student." });
      return;
    }
    const exchange = {
      id: createId("exchange"),
      skillId: offeredSkill.id,
      skillName: offeredSkill.name,
      fromId: studentId,
      toId: learningRequest.studentId,
      message: `I can help with ${offeredSkill.name}. I saw your learning request for ${learningRequest.name}.`,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    commit({ ...database, exchanges: [exchange, ...database.exchanges] }, "Your offer to help has been sent.");
  }

  function changeExchangeStatus(exchangeId, status) {
    if (!["accepted", "rejected", "completed"].includes(status)) return;
    const exchange = exchanges.find((item) => item.id === exchangeId);
    if (!exchange) return;
    const canAccept = status === "accepted" && exchange.toId === studentId && exchange.status === "pending";
    const canReject = status === "rejected" && exchange.toId === studentId && exchange.status === "pending";
    const canComplete = status === "completed" &&
      [exchange.fromId, exchange.toId].includes(studentId) &&
      exchange.status === "accepted";
    if (!canAccept && !canReject && !canComplete) {
      setNotice({ type: "error", text: "That exchange can’t be updated from your account." });
      return;
    }
    const next = {
      ...database,
      exchanges: database.exchanges.map((item) => item.id === exchangeId
        ? { ...item, status, updatedAt: new Date().toISOString() }
        : item),
    };
    commit(next, `Exchange marked ${status}.`);
  }

  const filteredSkills = useMemo(() => skills.filter((skill) => {
    const owner = database.profiles.find((profile) => profile.id === skill.studentId);
    const haystack = `${skill.name} ${skill.description} ${owner?.name || ""}`.toLowerCase();
    return skill.studentId !== studentId &&
      (!search || haystack.includes(search.toLowerCase())) &&
      (!categoryFilter || skill.category === categoryFilter) &&
      (!levelFilter || skill.level === levelFilter);
  }), [skills, database.profiles, studentId, search, categoryFilter, levelFilter]);

  const matchSuggestions = useMemo(() => {
    if (!studentId) return [];
    const needMatches = ownedLearningRequests.flatMap((request) =>
      skills.filter((skill) => skill.studentId !== studentId && skill.category === request.category)
        .map((skill) => ({
          type: "learn",
          request,
          skill,
          exact: normalizeSkillName(skill.name) === normalizeSkillName(request.name),
          preference: request.method === "Either works" || skill.preferences === request.method || skill.preferences === "Either works",
        }))
    );
    const offerMatches = ownedSkills.flatMap((skill) =>
      learningRequests.filter((request) => request.studentId !== studentId && request.category === skill.category)
        .map((request) => ({
          type: "teach",
          request,
          skill,
          exact: normalizeSkillName(skill.name) === normalizeSkillName(request.name),
          preference: request.method === "Either works" || skill.preferences === request.method || skill.preferences === "Either works",
        }))
    );
    const unique = new Map();
    [...needMatches, ...offerMatches].forEach((match) => {
      const otherStudent = match.type === "learn" ? match.skill.studentId : match.request.studentId;
      const key = `${match.type}:${match.skill.id}:${otherStudent}`;
      const existing = unique.get(key);
      const score = Number(match.exact) * 2 + Number(match.preference);
      if (!existing || score > Number(existing.exact) * 2 + Number(existing.preference)) unique.set(key, match);
    });
    return [...unique.values()].sort((a, b) =>
      (Number(b.exact) * 2 + Number(b.preference)) - (Number(a.exact) * 2 + Number(a.preference))
    );
  }, [studentId, skills, learningRequests, ownedSkills, ownedLearningRequests]);

  function renderLanding() {
    const stats = [
      { value: database.profiles.length, label: "student profiles" },
      { value: skills.length, label: "skills offered" },
      { value: learningRequests.length, label: "learning requests" },
      { value: exchanges.filter((exchange) => exchange.status === "accepted" || exchange.status === "completed").length, label: "active or completed exchanges" },
    ];
    const featured = skills.slice(0, 4);
    return (
      <>
        <header className="marketing-header">
          <a className="brand" href="#home"><span className="brand-symbol">S</span><span>SkillSwap<small>Share Skills. Grow Together.</small></span></a>
          <nav className="marketing-links" aria-label="Main navigation">
            <a href="#how-it-works">How it works</a><a href="#featured">Explore skills</a><a href="#community-preview">Community</a>
          </nav>
          <div className="header-actions">
            <button type="button" className="button button-outline button-small" onClick={() => navigate("login")}>Log in</button>
            <button type="button" className="button button-primary button-small" onClick={() => navigate("register")}>Join community</button>
          </div>
        </header>
        <main className="marketing">
          <section className="landing-hero">
            <div className="landing-copy">
              <Badge tone="blue">A campus community for learning</Badge>
              <h1>Share Skills.<br /><span>Grow Together.</span></h1>
              <p>Find a fellow student who can teach what you want to learn—or share what you already know. No scores, no pressure. Just students helping students.</p>
              <div className="landing-actions">
                <button type="button" className="button button-primary" onClick={() => navigate("explore")}>Explore skills <Icon name="chevron" /></button>
                <button type="button" className="button button-outline" onClick={() => navigate("register")}>Join community</button>
              </div>
              <div className="landing-proof"><span className="avatar-stack"><Avatar name="Mira Shah" size="tiny" /><Avatar name="Aarav Patel" size="tiny" /><Avatar name="Kabir Rao" size="tiny" /></span><span>Built around what students can teach each other.</span></div>
            </div>
            <div className="landing-art" aria-label="Students sharing skills">
              <div className="art-note art-note-top"><span className="art-note-icon blue">{"</>"}</span><span><strong>Python basics</strong><small>Offered by Aarav</small></span></div>
              <div className="art-center"><div className="art-circle"><Icon name="arrows" size={35} /></div><span>LEARN ↔ SHARE</span></div>
              <div className="art-note art-note-bottom"><span className="art-note-icon coral"><Icon name="sparkle" /></span><span><strong>Poster design</strong><small>Requested by Kabir</small></span></div>
              <span className="art-decoration art-decoration-one" /><span className="art-decoration art-decoration-two" />
            </div>
          </section>

          <section className="stat-strip" aria-label="Demonstration project data">
            {stats.map((stat) => <div className="stat-item" key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}
          </section>
          <p className="sample-note"><Icon name="info" size={14} /> Demonstration data is included so you can explore the student workflows. Counts reflect the records in this browser.</p>

          <section className="marketing-section how-section" id="how-it-works">
            <div className="section-intro"><Badge tone="gray">A simple exchange</Badge><h2>Learning works both ways.</h2><p>Share one skill, find one person, and learn together at your own pace.</p></div>
            <div className="how-grid">
              <article className="how-card"><span className="how-number">01</span><span className="how-icon"><Icon name="user" /></span><h3>Set up your profile</h3><p>Add your college details and a short introduction so other students know who they’ll be learning with.</p></article>
              <article className="how-card"><span className="how-number">02</span><span className="how-icon"><Icon name="book" /></span><h3>Offer or request</h3><p>List a skill you can teach, or post a clear learning goal and the way you prefer to learn.</p></article>
              <article className="how-card"><span className="how-number">03</span><span className="how-icon"><Icon name="arrows" /></span><h3>Make an exchange</h3><p>Send a request, agree on a plan, then mark your peer-to-peer exchange complete together.</p></article>
            </div>
          </section>

          <section className="marketing-section featured-section" id="featured">
            <div className="section-title-row"><div><Badge tone="blue">From the campus board</Badge><h2>Skills students are sharing.</h2></div><button type="button" className="link-button" onClick={() => navigate("explore")}>Browse all skills <Icon name="chevron" /></button></div>
            <div className="featured-grid">
              {featured.map((skill) => {
                const owner = database.profiles.find((profile) => profile.id === skill.studentId);
                return <article className="featured-card" key={skill.id}><div className={`skill-icon skill-icon-${categoryColor(skill.category)}`}><Icon name={skill.category === "Technology" ? "grid" : skill.category === "Design" ? "sparkle" : skill.category === "Media" ? "book" : "message"} /></div><div className="featured-top"><Badge tone={categoryColor(skill.category)}>{skill.category}</Badge><Badge>{skill.level}</Badge></div><h3>{skill.name}</h3><p>{skill.description}</p><div className="student-line"><Avatar name={owner?.name} size="small" /><span><strong>{owner?.name}</strong><small>{owner?.department}</small></span></div></article>;
              })}
            </div>
          </section>

          <section className="community-banner" id="community-preview"><div><Badge tone="light">Made for campus</Badge><h2>What could you teach<br />each other this week?</h2><p>Join the board, make a profile, and start with one skill you’re curious about.</p></div><button type="button" className="button button-white" onClick={() => navigate("register")}>Create your student profile <Icon name="chevron" /></button></section>
        </main>
        <footer className="marketing-footer"><a className="brand" href="#home"><span className="brand-symbol">S</span><span>SkillSwap<small>Share Skills. Grow Together.</small></span></a><span>A student-built project for peer-to-peer learning.</span><span>Project demo · Data stays in this browser</span></footer>
      </>
    );
  }

  function renderPublicExplore() {
    return <>
      <header className="marketing-header">
        <a className="brand" href="#home"><span className="brand-symbol">S</span><span>SkillSwap<small>Share Skills. Grow Together.</small></span></a>
        <nav className="marketing-links" aria-label="Main navigation"><a href="#home">Home</a><a href="#explore">Explore skills</a></nav>
        <div className="header-actions"><button type="button" className="button button-outline button-small" onClick={() => navigate("login")}>Log in</button><button type="button" className="button button-primary button-small" onClick={() => navigate("register")}>Join community</button></div>
      </header>
      <main className="public-explore">{renderExplore()}</main>
      <footer className="marketing-footer"><a className="brand" href="#home"><span className="brand-symbol">S</span><span>SkillSwap<small>Share Skills. Grow Together.</small></span></a><span>Browse student skills, then join to send a request.</span></footer>
    </>;
  }

  function renderAuth() {
    const registering = route === "register";
    return (
      <main className="auth-page">
        <button className="back-link" type="button" onClick={() => navigate("home")}>← Back to SkillSwap</button>
        <div className="auth-layout">
          <div className="auth-aside">
            <a className="brand" href="#home"><span className="brand-symbol">S</span><span>SkillSwap<small>Share Skills. Grow Together.</small></span></a>
            <div className="auth-aside-copy"><Badge tone="light">Student community</Badge><h1>Share Skills. Grow Together.</h1><p>A campus board for trading curiosity, time, and the skills you’ve picked up along the way.</p></div>
            <div className="auth-disclaimer"><Icon name="info" size={16} /><span>This college-project demo stores profiles in this browser. It is not connected to a college identity provider.</span></div>
          </div>
          <section className="auth-card">
            <div className="auth-heading"><p className="eyebrow">{registering ? "New to the board?" : "Good to see you again"}</p><h2>{registering ? "Create your profile" : "Welcome back"}</h2><p>{registering ? "A few details help classmates find you." : "Sign in to continue to your student workspace."}</p></div>
            <form className="stack-form" onSubmit={registering ? handleRegister : handleLogin}>
              {registering && <>
                <Field label="Full name"><input name="name" autoComplete="name" required minLength="2" maxLength="70" placeholder="e.g. Sam Taylor" /></Field>
                <Field label="College or university"><input name="college" autoComplete="organization" required maxLength="100" placeholder="Your institution" /></Field>
                <div className="form-row">
                  <Field label="Department / branch"><input name="department" required maxLength="70" placeholder="e.g. Computer Science" /></Field>
                  <Field label="Year of study"><select name="year" required defaultValue=""><option value="" disabled>Select year</option>{["1st Year", "2nd Year", "3rd Year", "4th Year", "Other"].map((year) => <option key={year}>{year}</option>)}</select></Field>
                </div>
              </>}
              <Field label="Student email"><input type="email" name="email" autoComplete="email" required maxLength="150" placeholder="you@college.edu" /></Field>
              <Field label="Password" hint={registering ? "Use at least 8 characters." : undefined}><input type="password" name="password" autoComplete={registering ? "new-password" : "current-password"} required minLength={registering ? 8 : 1} maxLength="128" placeholder={registering ? "At least 8 characters" : "Your password"} /></Field>
              {authError && <p className="form-error" role="alert">{authError}</p>}
              <button className="button button-primary button-block" type="submit" disabled={authBusy}>{authBusy ? "Please wait…" : registering ? "Create student profile" : "Sign in"}</button>
            </form>
            {!registering && <div className="demo-divider"><span>or explore the sample account</span><button type="button" className="button button-outline button-block" onClick={enterDemo}>Continue as demo student</button></div>}
            <p className="auth-switch">{registering ? "Already on the board?" : "New to the community?"} <button type="button" onClick={() => navigate(registering ? "login" : "register")}>{registering ? "Sign in" : "Create a profile"}</button></p>
          </section>
        </div>
      </main>
    );
  }

  function navLink(name, label, icon) {
    const active = route === name || (name === "explore" && route === "explore");
    return <button className={`nav-item ${active ? "active" : ""}`} key={name} type="button" onClick={() => navigate(name)}><Icon name={icon} size={18} /><span>{label}</span>{name === "exchanges" && pendingIncoming > 0 && <span className="nav-count">{pendingIncoming}</span>}</button>;
  }

  const pendingIncoming = exchanges.filter((exchange) => exchange.toId === studentId && exchange.status === "pending").length;
  const navGroups = [
    { label: "Workspace", items: [["dashboard", "Overview", "grid"], ["explore", "Explore skills", "search"], ["offer", "Offer a skill", "plus"], ["learn", "Learn a skill", "book"]] },
    { label: "Connect", items: [["matches", "Skill matches", "sparkle"], ["exchanges", "Exchange requests", "inbox"], ["community", "Community", "users"]] },
  ];

  function renderDashboard() {
    const incoming = exchanges.filter((exchange) => exchange.toId === studentId);
    const outgoing = exchanges.filter((exchange) => exchange.fromId === studentId);
    const recentSkills = ownedSkills.slice(0, 3);
    const miniMatches = matchSuggestions.slice(0, 3);
    const stats = [
      { label: "Skills offered", value: ownedSkills.length, icon: "book", tone: "blue", action: "offer" },
      { label: "Want to learn", value: ownedLearningRequests.length, icon: "sparkle", tone: "purple", action: "learn" },
      { label: "Incoming requests", value: incoming.length, icon: "inbox", tone: "orange", action: "exchanges" },
      { label: "Outgoing requests", value: outgoing.length, icon: "arrows", tone: "teal", action: "exchanges" },
      { label: "Completed exchanges", value: exchanges.filter((exchange) => exchange.status === "completed" && [exchange.fromId, exchange.toId].includes(studentId)).length, icon: "check", tone: "green", action: "exchanges" },
    ];
    return (
      <div className="page-content">
        <div className="welcome-row"><div><p className="eyebrow">Student workspace</p><h1>Good {greeting()}, {student.name.split(" ")[0]}.</h1><p>Here’s what’s happening on your skill board.</p></div><button className="button button-primary" type="button" onClick={() => navigate("offer")}><Icon name="plus" /> Offer a skill</button></div>
        <div className="demo-banner"><Icon name="info" size={16} /><span>Demo workspace · Counts are based on the sample and student records stored in this browser.</span></div>
        <div className="stats-grid">{stats.map((stat) => <button className="stat-card" key={stat.label} type="button" onClick={() => navigate(stat.action)}><span className={`stat-icon ${stat.tone}`}><Icon name={stat.icon} /></span><span className="stat-copy"><small>{stat.label}</small><strong>{stat.value}</strong></span><Icon className="stat-chevron" name="chevron" size={15} /></button>)}</div>
        <div className="dashboard-columns">
          <section className="panel">
            <div className="panel-heading"><div><h2>Recently added skills</h2><p>Your latest listings on the board</p></div><button type="button" className="link-button" onClick={() => navigate("offer")}>Manage listings <Icon name="chevron" /></button></div>
            {recentSkills.length === 0 ? <EmptyState icon="plus" title="No skills listed yet">Share something you can help a classmate learn.</EmptyState> : <div className="simple-list">{recentSkills.map((skill) => <div className="simple-row" key={skill.id}><span className={`skill-icon skill-icon-${categoryColor(skill.category)}`}><Icon name="book" /></span><span className="row-main"><strong>{skill.name}</strong><small>{skill.category} · {skill.level}</small></span><span className="row-date">{dateLabel(skill.createdAt)}</span></div>)}</div>}
            <button type="button" className="button button-outline button-small panel-action" onClick={() => navigate("offer")}><Icon name="plus" /> Add a skill listing</button>
          </section>
          <section className="panel">
            <div className="panel-heading"><div><h2>Good matches to explore</h2><p>Skills line up with your learning goals</p></div><button type="button" className="link-button" onClick={() => navigate("matches")}>View matches <Icon name="chevron" /></button></div>
            {miniMatches.length === 0 ? <EmptyState icon="sparkle" title="Add a learning goal">We’ll compare your requests with student skill listings.</EmptyState> : <div className="match-preview-list">{miniMatches.map((match, index) => {
              const profile = database.profiles.find((item) => item.id === (match.type === "learn" ? match.skill.studentId : match.request.studentId));
              return <button className="match-preview" type="button" key={`${match.type}-${match.skill.id}-${match.request.id}-${index}`} onClick={() => setProfileTarget(profile?.id)}><Avatar name={profile?.name} size="small" /><span><strong>{match.skill.name}</strong><small>{match.type === "learn" ? `Offered by ${profile?.name}` : `${profile?.name} wants to learn ${match.request.name}`}</small></span><Badge tone={match.exact ? "green" : "blue"}>{match.exact ? "Exact skill" : "Same category"}</Badge></button>;
            })}</div>}
          </section>
        </div>
        <section className="panel community-panel">
          <div className="panel-heading"><div><h2>From your community</h2><p>Students are sharing what they know</p></div><button type="button" className="link-button" onClick={() => navigate("community")}>Explore community <Icon name="chevron" /></button></div>
          <div className="community-preview">{database.profiles.filter((profile) => profile.id !== studentId).slice(0, 4).map((profile) => <button className="community-person" key={profile.id} type="button" onClick={() => setProfileTarget(profile.id)}><Avatar name={profile.name} /><span><strong>{profile.name}</strong><small>{profile.department} · {profile.year}</small></span></button>)}</div>
        </section>
      </div>
    );
  }

  function skillCard(skill) {
    const owner = database.profiles.find((profile) => profile.id === skill.studentId);
    const isOwn = skill.studentId === studentId;
    return <article className="skill-card" key={skill.id}>
      <div className="skill-card-heading"><span className={`skill-icon skill-icon-${categoryColor(skill.category)}`}><Icon name={skill.category === "Technology" ? "grid" : skill.category === "Design" ? "sparkle" : "book"} /></span><Badge tone={categoryColor(skill.category)}>{skill.category}</Badge></div>
      <h3>{skill.name}</h3><p className="skill-description">{skill.description}</p>
      <div className="skill-meta"><Badge>{skill.level}</Badge><span><Icon name="clock" size={14} /> {skill.availability}</span></div>
      <div className="student-line skill-owner"><Avatar name={owner?.name} size="small" /><span><strong>{owner?.name || "Student"}</strong><small>{owner?.department} · {owner?.year}</small></span></div>
      <div className="card-actions"><button type="button" className="button button-outline button-small" onClick={() => setProfileTarget(owner?.id)}>View profile</button>{isOwn ? <Badge tone="gray">Your listing</Badge> : <button type="button" className="button button-primary button-small" onClick={() => studentId ? setRequestTarget(skill) : navigate("register")}><Icon name="message" size={15} /> Request skill</button>}</div>
    </article>;
  }

  function renderExplore() {
    const categories = [...new Set(skills.map((skill) => skill.category))].sort();
    return <div className="page-content">
      <PageTitle eyebrow="Find a student to learn from" title="Explore skills" description="Browse what students are ready to teach. Filter by category or level, then send a clear request." action={<button className="button button-primary" type="button" onClick={() => navigate(studentId ? "offer" : "register")}><Icon name="plus" /> Offer a skill</button>} />
      <div className="filters-panel"><label className="search-field"><Icon name="search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search a skill or student" aria-label="Search a skill or student" /></label><label className="select-field"><Icon name="filter" /><select aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label className="select-field"><Icon name="filter" /><select aria-label="Filter by proficiency" value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}><option value="">All levels</option>{LEVELS.map((level) => <option key={level}>{level}</option>)}</select></label><span className="results-count">{filteredSkills.length} {filteredSkills.length === 1 ? "skill" : "skills"}</span></div>
      {filteredSkills.length ? <div className="skill-grid">{filteredSkills.map(skillCard)}</div> : <EmptyState icon="search" title="No skills match those filters">Try another search or clear a filter. You can also post what you’d like to learn.</EmptyState>}
      <section className="panel browse-requests"><div className="panel-heading"><div><h2>What students want to learn</h2><p>Someone may be hoping to learn a skill you already know</p></div><button type="button" className="link-button" onClick={() => navigate(studentId ? "learn" : "register")}>Browse learning requests <Icon name="chevron" /></button></div></section>
    </div>;
  }

  function renderOffer() {
    return <div className="page-content">
      <PageTitle eyebrow="Share what you know" title="Offer a skill" description="Make a clear, practical listing so other students know what you can teach and when you’re available." />
      <div className="offer-layout">
        <section className="panel form-panel"><div className="panel-heading"><div><h2>{editingSkill ? "Edit skill listing" : "Add a skill listing"}</h2><p>Specific details help classmates make a good request.</p></div></div>
          <form key={editingSkill?.id || "new"} className="stack-form" onSubmit={saveSkill}>
            <Field label="Skill name"><input name="name" required maxLength="70" defaultValue={editingSkill?.name || ""} placeholder="e.g. Intro to Python" /></Field>
            <div className="form-row"><Field label="Category"><select name="category" defaultValue={editingSkill?.category || CATEGORIES[0]}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></Field><Field label="Proficiency level"><select name="level" defaultValue={editingSkill?.level || "Intermediate"}>{LEVELS.map((level) => <option key={level}>{level}</option>)}</select></Field></div>
            <Field label="What can you help someone learn?"><textarea name="description" rows="4" required minLength="15" maxLength="350" defaultValue={editingSkill?.description || ""} placeholder="Describe the topics, tools, or outcome you can help with (15–350 characters)." /><span className="field-hint">Keep it practical so students know what to expect.</span></Field>
            <div className="form-row"><Field label="Teaching preference"><select name="preferences" defaultValue={editingSkill?.preferences || "Either works"}>{METHODS.map((method) => <option key={method}>{method}</option>)}</select></Field><Field label="Availability"><input name="availability" required maxLength="70" defaultValue={editingSkill?.availability || ""} placeholder="e.g. Weekday evenings" /></Field></div>
            <div className="form-actions"><button type="submit" className="button button-primary">{editingSkill ? "Save changes" : "Publish skill"}</button>{editingSkill && <button type="button" className="button button-outline" onClick={() => setEditingSkill(null)}>Cancel edit</button>}</div>
          </form>
        </section>
        <aside className="side-note"><span className="side-note-icon"><Icon name="sparkle" /></span><h3>Good listings start with a clear offer.</h3><p>Think about what a student will be able to do after a session. Mention a tool, a topic, or a small outcome rather than just a broad subject.</p><div className="note-example"><small>EXAMPLE</small><p>“Build your first responsive page with HTML and CSS. We’ll cover layout, spacing, and mobile checks.”</p></div></aside>
      </div>
      <section className="panel owned-listings"><div className="panel-heading"><div><h2>Your skill listings</h2><p>Edit availability or remove listings you no longer offer</p></div><Badge>{ownedSkills.length} listed</Badge></div>
        {!ownedSkills.length ? <EmptyState icon="book" title="No listings yet">Your published skills will appear here.</EmptyState> : <div className="table-scroll"><table><thead><tr><th>Skill</th><th>Category</th><th>Level</th><th>Availability</th><th>Actions</th></tr></thead><tbody>{ownedSkills.map((skill) => <tr key={skill.id}><td><strong>{skill.name}</strong><small className="table-subtext">{skill.description}</small></td><td><Badge tone={categoryColor(skill.category)}>{skill.category}</Badge></td><td>{skill.level}</td><td>{skill.availability}</td><td><div className="row-actions"><button className="icon-button" type="button" aria-label={`Edit ${skill.name}`} onClick={() => { setEditingSkill(skill); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Icon name="edit" size={16} /></button><button className="icon-button danger-icon" type="button" aria-label={`Delete ${skill.name}`} onClick={() => deleteSkill(skill)}><Icon name="trash" size={16} /></button></div></td></tr>)}</tbody></table></div>}
      </section>
    </div>;
  }

  function renderLearn() {
    const otherRequests = learningRequests.filter((request) => request.studentId !== studentId);
    return <div className="page-content">
      <PageTitle eyebrow="Be honest about what you need" title="Learn a skill" description="Post a learning goal that helps a student understand what you’re hoping to practice." />
      <div className="two-column-layout">
        <section className="panel form-panel"><div className="panel-heading"><div><h2>Post a learning request</h2><p>Your request is visible to students in this browser demo.</p></div></div>
          <form className="stack-form" onSubmit={saveLearningRequest}>
            <Field label="Skill you want to learn"><input name="name" required maxLength="70" placeholder="e.g. Figma prototyping" /></Field>
            <div className="form-row"><Field label="Category"><select name="category" defaultValue={CATEGORIES[0]}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></Field><Field label="Current level"><select name="level" defaultValue="Beginner">{LEVELS.map((level) => <option key={level}>{level}</option>)}</select></Field></div>
            <Field label="Your learning goal"><input name="goals" required minLength="10" maxLength="140" placeholder="What would you like to be able to do?" /></Field>
            <Field label="A little more detail"><textarea name="description" rows="3" required minLength="15" maxLength="300" placeholder="What kind of help or practice would be useful?" /></Field>
            <Field label="Preferred learning method"><select name="method" defaultValue="Either works">{METHODS.map((method) => <option key={method}>{method}</option>)}</select></Field>
            <button type="submit" className="button button-primary">Post learning request</button>
          </form>
        </section>
        <section className="panel"><div className="panel-heading"><div><h2>Your learning goals</h2><p>Requests you’ve posted to the board</p></div><Badge>{ownedLearningRequests.length} active</Badge></div>
          {!ownedLearningRequests.length ? <EmptyState icon="sparkle" title="No learning goals yet">Post a skill you’re curious about and we’ll look for student matches.</EmptyState> : <div className="request-list">{ownedLearningRequests.map((request) => <article className="request-card" key={request.id}><div className="request-top"><Badge tone={categoryColor(request.category)}>{request.category}</Badge><button className="icon-button danger-icon" type="button" aria-label={`Remove ${request.name} learning request`} onClick={() => deleteLearningRequest(request)}><Icon name="trash" size={16} /></button></div><h3>{request.name}</h3><p>{request.goals}</p><small>{request.level} · {request.method}</small><p className="request-description">{request.description}</p></article>)}</div>}
        </section>
      </div>
      <section className="panel request-browse"><div className="panel-heading"><div><h2>Students looking to learn</h2><p>Offer help when you have a related skill listed</p></div></div>
        {!otherRequests.length ? <EmptyState icon="users" title="No requests from other students yet">New learning goals from the community will appear here.</EmptyState> : <div className="request-grid">{otherRequests.map((request) => {
          const owner = database.profiles.find((profile) => profile.id === request.studentId);
          const matchingSkill = ownedSkills.find((skill) => skill.category === request.category || normalizeSkillName(skill.name) === normalizeSkillName(request.name));
          return <article className="request-card" key={request.id}><div className="request-top"><Badge tone={categoryColor(request.category)}>{request.category}</Badge><span className="request-date">{dateLabel(request.createdAt)}</span></div><h3>{request.name}</h3><p>{request.goals}</p><div className="student-line"><Avatar name={owner?.name} size="small" /><span><strong>{owner?.name}</strong><small>{owner?.department}</small></span></div>{matchingSkill ? <button className="button button-outline button-small" type="button" onClick={() => requestAssistance(request, matchingSkill)}>Offer help with {matchingSkill.name}</button> : <span className="subtle-text">No matching skill in your listings yet</span>}</article>;
        })}</div>}
      </section>
    </div>;
  }

  function renderMatches() {
    return <div className="page-content">
      <PageTitle eyebrow="Transparent skill matching" title="People to learn with" description="Matches are ranked by an explicit rule: same category, exact skill name, and compatible learning or teaching preferences." action={<button className="button button-outline" type="button" onClick={() => navigate("learn")}><Icon name="plus" /> Add a learning goal</button>} />
      <div className="matching-explainer"><Icon name="info" /><p><strong>How this works:</strong> we compare skill categories across your learning requests, your offers, and other students’ listings. Exact skill-name matches rank first; compatible format preferences break ties. This is a transparent rule-based comparison, not AI.</p></div>
      {!matchSuggestions.length ? <EmptyState icon="sparkle" title="No matches to show yet">Add a skill you want to learn or offer. We’ll compare the categories with the board.</EmptyState> : <div className="match-grid">{matchSuggestions.map((match, index) => {
        const otherStudentId = match.type === "learn" ? match.skill.studentId : match.request.studentId;
        const owner = database.profiles.find((profile) => profile.id === otherStudentId);
        const alreadySent = exchanges.some((exchange) => exchange.fromId === studentId && exchange.toId === owner?.id && exchange.skillId === match.skill.id && ["pending", "accepted"].includes(exchange.status));
        return <article className="match-card" key={`${match.type}-${match.skill.id}-${match.request.id}-${index}`}>
          <div className="match-card-top"><span className="match-avatar"><Avatar name={owner?.name} /></span><Badge tone={match.exact ? "green" : "blue"}>{match.exact ? "Exact skill match" : "Same category"}</Badge></div>
          <h3>{match.type === "learn" ? match.skill.name : `${owner?.name} wants to learn ${match.request.name}`}</h3>
          <p>{match.type === "learn" ? `${owner?.name} offers ${match.skill.name} · You want to learn ${match.request.name}.` : `Your listing ${match.skill.name} fits ${owner?.name}’s learning request.`}</p>
          <div className="match-rules"><span><Icon name="check" size={14} /> {match.exact ? "Skill name matches" : "Category aligns"}</span><span><Icon name={match.preference ? "check" : "clock"} size={14} /> {match.preference ? "Learning format compatible" : "Discuss a format together"}</span></div>
          <div className="student-line"><span><strong>{owner?.name}</strong><small>{owner?.college} · {owner?.department}</small></span></div>
          <div className="card-actions"><button className="button button-outline button-small" type="button" onClick={() => setProfileTarget(owner?.id)}>View profile</button>{match.type === "learn" ? <button className="button button-primary button-small" type="button" disabled={alreadySent} onClick={() => setRequestTarget(match.skill)}>{alreadySent ? "Request sent" : "Request skill"}</button> : <button className="button button-primary button-small" type="button" onClick={() => requestAssistance(match.request, match.skill)}>Offer help</button>}</div>
        </article>;
      })}</div>}
    </div>;
  }

  function renderExchanges() {
    const visible = exchanges.filter((exchange) => exchange.fromId === studentId || exchange.toId === studentId)
      .filter((exchange) => exchangeFilter === "All" || exchange.status === exchangeFilter.toLowerCase());
    const tabs = ["All", "Pending", "Accepted", "Rejected", "Completed"];
    const nameFor = (id) => database.profiles.find((profile) => profile.id === id)?.name || "Student";
    return <div className="page-content">
      <PageTitle eyebrow="Coordinate peer-to-peer learning" title="Exchange requests" description="Send a short note, agree on how to meet, and keep the request status up to date." action={<button className="button button-primary" type="button" onClick={() => navigate("explore")}><Icon name="search" /> Find a skill</button>} />
      <div className="exchange-tabs" role="tablist" aria-label="Filter exchange requests">{tabs.map((tab) => <button key={tab} type="button" role="tab" aria-selected={exchangeFilter === tab} className={exchangeFilter === tab ? "selected" : ""} onClick={() => setExchangeFilter(tab)}>{tab}<span>{tab === "All" ? exchanges.filter((item) => [item.fromId, item.toId].includes(studentId)).length : exchanges.filter((item) => [item.fromId, item.toId].includes(studentId) && item.status === tab.toLowerCase()).length}</span></button>)}</div>
      {!visible.length ? <EmptyState icon="inbox" title={`No ${exchangeFilter === "All" ? "" : exchangeFilter.toLowerCase() + " "}exchange requests`}>{exchangeFilter === "All" ? "Browse skills and send a request to start a peer-to-peer exchange." : "Try another status filter or explore skills to send a request."}<button className="button button-primary button-small" type="button" onClick={() => navigate("explore")}>Explore skills</button></EmptyState> : <div className="exchange-list">{visible.map((exchange) => {
        const incomingRequest = exchange.toId === studentId;
        const otherPerson = incomingRequest ? nameFor(exchange.fromId) : nameFor(exchange.toId);
        const tone = { pending: "orange", accepted: "green", rejected: "red", completed: "blue" }[exchange.status] || "gray";
        return <article className="exchange-card" key={exchange.id}>
          <div className={`exchange-status-icon ${tone}`}><Icon name={exchange.status === "completed" ? "check" : exchange.status === "pending" ? "clock" : "arrows"} /></div>
          <div className="exchange-body"><div className="exchange-title-row"><div><h3>{exchange.skillName}</h3><p>{incomingRequest ? `${otherPerson} sent you a request` : `Request to ${otherPerson}`}</p></div><Badge tone={tone}>{exchange.status}</Badge></div><p className="exchange-message">“{exchange.message}”</p><div className="exchange-meta"><span><Icon name="clock" size={14} /> Requested {dateLabel(exchange.createdAt)}</span><span>{incomingRequest ? "Incoming" : "Outgoing"} · {nameFor(exchange.fromId)} ↔ {nameFor(exchange.toId)}</span></div>
            {exchange.status === "pending" && incomingRequest && <div className="exchange-actions"><button type="button" className="button button-primary button-small" onClick={() => changeExchangeStatus(exchange.id, "accepted")}><Icon name="check" size={15} /> Accept</button><button type="button" className="button button-outline button-small" onClick={() => changeExchangeStatus(exchange.id, "rejected")}>Decline</button></div>}
            {exchange.status === "accepted" && <div className="exchange-actions"><span className="subtle-text">Coordinate a time and format directly with your peer.</span><button type="button" className="button button-primary button-small" onClick={() => changeExchangeStatus(exchange.id, "completed")}><Icon name="check" size={15} /> Mark complete</button></div>}
          </div>
        </article>;
      })}</div>}
      <div className="privacy-note"><Icon name="info" size={15} /><span>For this prototype, exchanges are coordinated peer-to-peer. Agree on a meeting time and format before you begin.</span></div>
    </div>;
  }

  function renderProfile() {
    const offers = ownedSkills;
    const goals = ownedLearningRequests;
    function submitProfile(event) {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const updated = {
        ...student,
        name: String(form.get("name") || "").trim(),
        college: String(form.get("college") || "").trim(),
        department: String(form.get("department") || "").trim(),
        year: String(form.get("year") || ""),
        introduction: String(form.get("introduction") || "").trim(),
        contact: String(form.get("contact") || "").trim(),
      };
      if (updated.name.length < 2 || !updated.college || !updated.department || updated.introduction.length > 280) {
        setNotice({ type: "error", text: "Check your name, college, department, and introduction (280 characters maximum)." });
        return;
      }
      updateProfile(updated);
    }
    return <div className="page-content">
      <PageTitle eyebrow="Your student identity" title="Your profile" description="Keep your introduction current so students know what you can offer and how to connect." />
      <div className="profile-layout">
        <section className="panel profile-form-panel"><div className="profile-card-top"><Avatar name={student.name} size="large" /><div><h2>{student.name}</h2><p>{student.department} · {student.year}</p><small>Joined {dateLabel(student.joinedAt)}</small></div></div>
          <form className="stack-form" onSubmit={submitProfile}>
            <div className="form-row"><Field label="Full name"><input name="name" required maxLength="70" defaultValue={student.name} /></Field><Field label="Year of study"><select name="year" defaultValue={student.year}>{["1st Year", "2nd Year", "3rd Year", "4th Year", "Other"].map((year) => <option key={year}>{year}</option>)}</select></Field></div>
            <Field label="College or university"><input name="college" required maxLength="100" defaultValue={student.college} /></Field>
            <Field label="Department / branch"><input name="department" required maxLength="70" defaultValue={student.department} /></Field>
            <Field label="Short introduction"><textarea name="introduction" rows="4" maxLength="280" defaultValue={student.introduction} placeholder="What are you studying, and what do you enjoy sharing?" /></Field>
            <Field label="Contact preference" hint="Avoid posting private contact information on a shared device."><input name="contact" maxLength="120" defaultValue={student.contact} /></Field>
            <Field label="Student email"><input value={student.email} readOnly /><span className="field-hint">Email is tied to your local login and can’t be changed here.</span></Field>
            <button className="button button-primary" type="submit"><Icon name="check" /> Save profile</button>
          </form>
        </section>
        <aside className="panel profile-summary"><h3>Your board at a glance</h3><div className="profile-stat"><span>Skills you offer</span><strong>{offers.length}</strong></div><div className="profile-stat"><span>Skills you want to learn</span><strong>{goals.length}</strong></div><div className="profile-stat"><span>Exchange requests</span><strong>{exchanges.filter((item) => [item.fromId, item.toId].includes(studentId)).length}</strong></div><div className="profile-skill-list"><h4>Your skill areas</h4>{offers.length ? offers.slice(0, 5).map((skill) => <Badge key={skill.id} tone={categoryColor(skill.category)}>{skill.name}</Badge>) : <span className="subtle-text">Add a skill listing to get started.</span>}</div><button className="button button-outline button-block" type="button" onClick={() => navigate("offer")}>Manage skill listings</button></aside>
      </div>
    </div>;
  }

  function renderCommunity() {
    const popular = [...new Map(skills.map((skill) => [normalizeSkillName(skill.name), skill])).values()]
      .map((skill) => ({ ...skill, count: skills.filter((item) => normalizeSkillName(item.name) === normalizeSkillName(skill.name)).length }))
      .sort((a, b) => b.count - a.count).slice(0, 6);
    const recentlyJoined = [...database.profiles].sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt)).slice(0, 6);
    const activeExchanges = exchanges.filter((exchange) => exchange.status === "accepted");
    return <div className="page-content">
      <PageTitle eyebrow="Students learning together" title="Community board" description="See who has joined, what skills are on offer, and which exchanges are underway." action={<button className="button button-primary" type="button" onClick={() => navigate("explore")}><Icon name="search" /> Explore skills</button>} />
      <div className="community-stats"><div><strong>{database.profiles.length}</strong><span>student profiles</span></div><div><strong>{skills.length}</strong><span>skill listings</span></div><div><strong>{activeExchanges.length}</strong><span>accepted exchanges</span></div></div>
      <div className="dashboard-columns community-columns">
        <section className="panel"><div className="panel-heading"><div><h2>Recently joined</h2><p>New classmates on the board</p></div></div><div className="people-list">{recentlyJoined.map((profile) => <button className="people-row" key={profile.id} type="button" onClick={() => setProfileTarget(profile.id)}><Avatar name={profile.name} /><span><strong>{profile.name}</strong><small>{profile.college} · {profile.department}</small></span><small className="row-date">{dateLabel(profile.joinedAt)}</small><Icon name="chevron" size={15} /></button>)}</div></section>
        <section className="panel"><div className="panel-heading"><div><h2>Skills to discover</h2><p>Popular and recently listed topics</p></div></div>{popular.length ? <div className="popular-list">{popular.map((skill) => <button type="button" className="popular-row" key={skill.id} onClick={() => { setSearch(skill.name); navigate("explore"); }}><span className={`skill-icon skill-icon-${categoryColor(skill.category)}`}><Icon name="book" size={16} /></span><span><strong>{skill.name}</strong><small>{skill.category}</small></span><Badge>{skill.count} {skill.count === 1 ? "listing" : "listings"}</Badge></button>)}</div> : <EmptyState icon="book" title="No skill listings yet">Student skill listings will appear here.</EmptyState>}</section>
      </div>
      <section className="panel active-exchanges"><div className="panel-heading"><div><h2>Active exchanges</h2><p>Accepted requests students are coordinating</p></div><button type="button" className="link-button" onClick={() => navigate(studentId ? "exchanges" : "login")}>Exchange requests <Icon name="chevron" /></button></div>
        {!activeExchanges.length ? <EmptyState icon="arrows" title="No active exchanges yet">Accepted skill exchanges will be shown here.</EmptyState> : <div className="active-exchange-grid">{activeExchanges.slice(0, 4).map((exchange) => <article className="active-exchange" key={exchange.id}><Badge tone="green">In progress</Badge><h3>{exchange.skillName}</h3><p>{database.profiles.find((profile) => profile.id === exchange.fromId)?.name} ↔ {database.profiles.find((profile) => profile.id === exchange.toId)?.name}</p><small>Started {dateLabel(exchange.createdAt)}</small></article>)}</div>}
      </section>
    </div>;
  }

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    return "evening";
  }

  function PageTitle({ eyebrow, title, description, action }) {
    return <div className="page-title-row"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{action && <div className="page-title-action">{action}</div>}</div>;
  }

  function renderWorkspace() {
    const view = {
      dashboard: renderDashboard,
      explore: renderExplore,
      offer: renderOffer,
      learn: renderLearn,
      matches: renderMatches,
      exchanges: renderExchanges,
      profile: renderProfile,
      community: renderCommunity,
    }[route] || renderDashboard;
    return <div className={`app-shell ${mobileNavOpen ? "nav-open" : ""}`}>
      <aside className="sidebar">
        <a className="brand sidebar-brand" href="#dashboard"><span className="brand-symbol">S</span><span>SkillSwap<small>Share Skills. Grow Together.</small></span></a>
        <div className="sidebar-demo"><span className="demo-dot" /> Local project demo</div>
        <nav className="sidebar-nav" aria-label="Student workspace navigation">
          {navGroups.map((group) => <div className="nav-group" key={group.label}><span className="nav-group-label">{group.label}</span>{group.items.map(([name, label, icon]) => navLink(name, label, icon))}</div>)}
        </nav>
        <div className="sidebar-bottom">
          <button className={`nav-item ${route === "profile" ? "active" : ""}`} type="button" onClick={() => navigate("profile")}><Icon name="settings" /><span>My profile</span></button>
          <div className="sidebar-user"><Avatar name={student.name} size="small" /><span><strong>{student.name}</strong><small>{student.department}</small></span><button type="button" className="icon-button" onClick={logout} aria-label="Sign out"><Icon name="logout" size={16} /></button></div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-topbar">
          <button type="button" className="icon-button mobile-menu" aria-label="Open navigation menu" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen((open) => !open)}><Icon name={mobileNavOpen ? "close" : "menu"} /></button>
          <div className="breadcrumb"><a href="#dashboard">Workspace</a><Icon name="chevron" size={14} /><span>{({ dashboard: "Overview", explore: "Explore skills", offer: "Offer a skill", learn: "Learn a skill", matches: "Skill matches", exchanges: "Exchange requests", profile: "My profile", community: "Community" })[route]}</span></div>
          <div className="topbar-right"><button className="topbar-link" type="button" onClick={() => navigate("explore")}><Icon name="search" size={16} /> Explore skills</button><button className="top-profile" type="button" onClick={() => navigate("profile")}><Avatar name={student.name} size="small" /><span>{student.name.split(" ")[0]}</span></button></div>
        </header>
        {view()}
        <footer className="workspace-footer"><span>SkillSwap · College project demo</span><span>Student records are stored in this browser.</span></footer>
      </div>
      {mobileNavOpen && <button className="mobile-backdrop" type="button" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
    </div>;
  }

  function renderProfileModal() {
    if (!profileTarget) return null;
    const profile = database.profiles.find((item) => item.id === profileTarget);
    if (!profile) return null;
    const profileSkills = skills.filter((skill) => skill.studentId === profile.id);
    const profileNeeds = learningRequests.filter((request) => request.studentId === profile.id);
    return <Modal title="Student profile" onClose={() => setProfileTarget(null)}>
      <div className="public-profile-head"><Avatar name={profile.name} size="large" /><div><h3>{profile.name}</h3><p>{profile.department} · {profile.year}</p></div></div>
      <div className="profile-facts"><span><Icon name="pin" size={15} />{profile.college}</span><span><Icon name="clock" size={15} />Joined {dateLabel(profile.joinedAt)}</span></div>
      <div className="public-profile-bio"><h4>About</h4><p>{profile.introduction || "This student hasn’t added an introduction yet."}</p></div>
      <div className="public-profile-bio"><h4>Skills offered</h4>{profileSkills.length ? <div className="profile-skill-chips">{profileSkills.map((skill) => <Badge key={skill.id} tone={categoryColor(skill.category)}>{skill.name} · {skill.level}</Badge>)}</div> : <p>No skill listings yet.</p>}</div>
      <div className="public-profile-bio"><h4>Wants to learn</h4>{profileNeeds.length ? <div className="profile-skill-chips">{profileNeeds.map((request) => <Badge key={request.id}>{request.name}</Badge>)}</div> : <p>No learning requests listed.</p>}</div>
      <div className="profile-contact-note"><Icon name="message" size={16} /><span>{profile.contact || "Send a skill request to start a conversation."}</span></div>
      <div className="modal-actions"><button className="button button-outline" type="button" onClick={() => setProfileTarget(null)}>Close</button>{studentId && profile.id !== studentId && profileSkills.length > 0 && <button className="button button-primary" type="button" onClick={() => { setProfileTarget(null); setRequestTarget(profileSkills[0]); }}>Request a skill</button>}{!studentId && <button className="button button-primary" type="button" onClick={() => { setProfileTarget(null); navigate("register"); }}>Join to connect</button>}</div>
    </Modal>;
  }

  function renderRequestModal() {
    if (!requestTarget) return null;
    const owner = database.profiles.find((profile) => profile.id === requestTarget.studentId);
    return <Modal title="Request a skill" onClose={() => setRequestTarget(null)}>
      <div className="request-modal-summary"><span className={`skill-icon skill-icon-${categoryColor(requestTarget.category)}`}><Icon name="book" /></span><span><strong>{requestTarget.name}</strong><small>Offered by {owner?.name} · {requestTarget.level}</small></span></div>
      <p className="modal-description">Tell {owner?.name?.split(" ")[0] || "this student"} what you’d like to work on. Your request will appear in both students’ exchange lists.</p>
      <form className="stack-form" onSubmit={(event) => {
        event.preventDefault();
        const message = String(new FormData(event.currentTarget).get("message") || "").trim();
        if (message.length < 12) {
          setNotice({ type: "error", text: "Add a short note (at least 12 characters) about what you’d like to learn." });
          return;
        }
        createExchange(requestTarget, message);
      }}>
        <Field label="Your note"><textarea name="message" rows="4" required minLength="12" maxLength="280" placeholder="What would you like help learning? Add a goal or context." /></Field>
        <p className="field-hint">Keep requests focused. Avoid including private contact details.</p>
        <div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setRequestTarget(null)}>Cancel</button><button type="submit" className="button button-primary">Send exchange request</button></div>
      </form>
    </Modal>;
  }

  return <>
    {!studentId && (route === "home" || route === "community") ? renderLanding() : null}
    {!studentId && route === "explore" ? renderPublicExplore() : null}
    {(route === "login" || route === "register") ? renderAuth() : null}
    {(student && !["home", "login", "register"].includes(route)) ? renderWorkspace() : null}
    {!student && !["home", "login", "register", "community", "explore"].includes(route) ? renderAuth() : null}
    {renderProfileModal()}
    {renderRequestModal()}
    {notice && <div className={`toast toast-${notice.type}`} role="status"><span>{notice.text}</span><button type="button" aria-label="Dismiss message" onClick={() => setNotice(null)}><Icon name="close" size={16} /></button></div>}
  </>;
}

export default App;
