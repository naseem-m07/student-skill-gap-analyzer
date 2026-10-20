import { useState } from "react";
import "./App.css";

const API = "http://127.0.0.1:8002";

const careerSkills = {
  "Cloud Engineer": ["Python", "Linux", "Networking", "AWS", "Git", "Docker"],
  "Software Developer": ["Python", "Java", "SQL", "Git", "DSA", "OOP"],
  "Data Analyst": ["Python", "SQL", "Excel", "Power BI", "Statistics"],
  "Web Developer": ["HTML", "CSS", "JavaScript", "React", "Node.js", "SQL"],
  "Cybersecurity Analyst": ["Linux", "Networking", "Python", "Cybersecurity", "SQL"],
  "AI/ML Engineer": ["Python", "Machine Learning", "Statistics", "Pandas", "SQL"]
};

const authHeaders = (token) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`
});

function App() {
  const [page, setPage] = useState("login");
  const [student, setStudent] = useState(null);
  const [token, setToken] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [career, setCareer] = useState("Cloud Engineer");
  const [skills, setSkills] = useState([]);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [progress, setProgress] = useState({});

  const [loading, setLoading] = useState(false);
  const [savingSkill, setSavingSkill] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const required = careerSkills[career];

  const completedCount = required.filter(
    (skill) => progress[skill] === "Completed"
  ).length;

  const completionPercentage = Math.round(
    (completedCount / required.length) * 100
  );

  const clearMessages = () => {
    setMessage("");
    setError("");
  };

  const changePage = (newPage) => {
    setPage(newPage);
    clearMessages();
    setPassword("");
  };

  const getError = (data, fallback) => {
    if (typeof data?.detail === "string") return data.detail;
    if (Array.isArray(data?.detail)) {
      return data.detail.map((item) => item.msg).join(", ");
    }
    return fallback;
  };

  // REGISTER
  const register = async (e) => {
    e.preventDefault();
    setLoading(true);
    clearMessages();

    try {
      const response = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(getError(data, "Registration failed"));
      }

      setMessage("Registration successful! Please login.");
      setPage("login");
      setPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // FETCH HISTORY
  const fetchHistory = async (studentId, accessToken = token) => {
    try {
      const response = await fetch(`${API}/history/${studentId}`, {
        headers: authHeaders(accessToken)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(getError(data, "History loading failed"));
      }

      setHistory(data.history || []);
    } catch (err) {
      setError(err.message);
    }
  };

  // FETCH PROGRESS
  const fetchProgress = async (studentId, accessToken = token) => {
    try {
      const response = await fetch(`${API}/progress/${studentId}`, {
        headers: authHeaders(accessToken)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(getError(data, "Progress loading failed"));
      }

      const progressMap = {};

      (data.progress || []).forEach((item) => {
        progressMap[item.skill] = item.status;
      });

      setProgress(progressMap);
    } catch (err) {
      setError(err.message);
    }
  };

  // LOGIN
  const login = async (e) => {
    e.preventDefault();
    setLoading(true);
    clearMessages();

    try {
      const response = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(getError(data, "Login failed"));
      }

      if (!data.access_token) {
        throw new Error("Login token not received");
      }

      const accessToken = data.access_token;

      setToken(accessToken);
      setStudent({
        id: data.student_id,
        name: data.name
      });

      setPassword("");
      setPage("dashboard");

      await Promise.all([
        fetchHistory(data.student_id, accessToken),
        fetchProgress(data.student_id, accessToken)
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // LOGOUT
  const logout = () => {
    setStudent(null);
    setToken("");
    setName("");
    setEmail("");
    setPassword("");
    setCareer("Cloud Engineer");
    setSkills([]);
    setResult(null);
    setHistory([]);
    setProgress({});
    changePage("login");
  };

  // SELECT SKILLS
  const toggleSkill = (skill) => {
    setSkills((prev) =>
      prev.includes(skill)
        ? prev.filter((s) => s !== skill)
        : [...prev, skill]
    );
    setResult(null);
  };

  // ANALYZE SKILLS
  const analyze = async () => {
    if (!student || !token) {
      setError("Please login first");
      return;
    }

    setLoading(true);
    clearMessages();
    setResult(null);

    try {
      const response = await fetch(`${API}/analyze`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ career, skills })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(getError(data, "Analysis failed"));
      }

      setResult(data);

      const saveResponse = await fetch(`${API}/save-analysis`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          student_id: student.id,
          career,
          skills
        })
      });

      const savedData = await saveResponse.json();

      if (!saveResponse.ok) {
        throw new Error(getError(savedData, "Analysis saving failed"));
      }

      setMessage("Analysis completed and saved successfully!");
      await fetchHistory(student.id, token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // SAVE PROGRESS
  const saveProgress = async (skill) => {
    if (!student || !token) {
      setError("Please login first");
      return;
    }

    setSavingSkill(skill);
    clearMessages();

    try {
      const response = await fetch(`${API}/progress`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          student_id: student.id,
          skill,
          status: progress[skill] || "Not Started"
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(getError(data, "Progress saving failed"));
      }

      setMessage(`${skill} progress saved successfully!`);
      await fetchProgress(student.id, token);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingSkill("");
    }
  };

  return (
    <div className="app">

      <header className="header">
        <h1>🎓 Student Skill Gap Analyzer</h1>
        <p>Discover Your Skills. Build Your Future.</p>
      </header>

      <main className="container">

        {/* REGISTER */}
        {page === "register" && (
          <section className="card auth-card">
            <h2>📝 Student Registration</h2>
            <p>Create your student account.</p>

            <form onSubmit={register} className="auth-form">
              <label>Full Name</label>
              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <label>Email Address</label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <label>Password</label>
              <input
                type="password"
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />

              <button type="submit" disabled={loading}>
                {loading ? "Registering..." : "Register"}
              </button>
            </form>

            {error && <p className="error-message">{error}</p>}

            <p>
              Already have an account?{" "}
              <button
                type="button"
                className="link-button"
                onClick={() => changePage("login")}
              >
                Login
              </button>
            </p>
          </section>
        )}

        {/* LOGIN */}
        {page === "login" && (
          <section className="card auth-card">
            <h2>🔐 Student Login</h2>
            <p>Login to continue your learning journey.</p>

            <form onSubmit={login} className="auth-form">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <label>Password</label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <button type="submit" disabled={loading}>
                {loading ? "Logging in..." : "Login"}
              </button>
            </form>

            {message && <p className="success-message">{message}</p>}
            {error && <p className="error-message">{error}</p>}

            <p>
              Don't have an account?{" "}
              <button
                type="button"
                className="link-button"
                onClick={() => changePage("register")}
              >
                Register
              </button>
            </p>
          </section>
        )}

        {/* DASHBOARD */}
        {page === "dashboard" && student && (
          <>
            <section className="card">
              <div className="dashboard-header">
                <div>
                  <h2>👋 Welcome, {student.name}!</h2>
                  <p>Your Student Skill Gap Dashboard</p>
                </div>
                <button onClick={logout}>Logout</button>
              </div>
            </section>

            {/* CAREER */}
            <section className="card">
              <h2>🎯 Select Your Career Goal</h2>

              <select
                value={career}
                onChange={(e) => {
                  setCareer(e.target.value);
                  setSkills([]);
                  setResult(null);
                  clearMessages();
                }}
              >
                {Object.keys(careerSkills).map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </section>

            {/* SKILLS */}
            <section className="card">
              <h2>📚 Select Your Current Skills</h2>
              <p>Select the skills you already know.</p>

              <div className="skills-grid">
                {required.map((skill) => (
                  <label className="skill-item" key={skill}>
                    <input
                      type="checkbox"
                      checked={skills.includes(skill)}
                      onChange={() => toggleSkill(skill)}
                    />
                    {skill}
                  </label>
                ))}
              </div>

              <button onClick={analyze} disabled={loading}>
                {loading ? "Analyzing..." : "Analyze My Skills"}
              </button>

              {error && <p className="error-message">{error}</p>}
              {message && <p className="success-message">{message}</p>}
            </section>

            {/* ANALYSIS */}
            {result && (
              <section className="card result">
                <h2>📊 Skill Gap Analysis</h2>

                <div className="score">{result.percentage}%</div>
                <p>Your Skill Match Score</p>

                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${result.percentage}%` }}
                  />
                </div>

                <h3>✅ Your Strengths</h3>
                {result.matched_skills.length ? (
                  <ul>
                    {result.matched_skills.map((skill) => (
                      <li key={skill}>{skill}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No matching skills selected.</p>
                )}

                <h3>⚠️ Missing Skills</h3>
                {result.missing_skills.length ? (
                  <ul>
                    {result.missing_skills.map((skill) => (
                      <li key={skill}>{skill}</li>
                    ))}
                  </ul>
                ) : (
                  <p>All required skills selected!</p>
                )}

                <h3>🚀 Your Learning Roadmap</h3>
                {result.roadmap.length ? (
                  <ol>
                    {result.roadmap.map((item, index) => (
                      <li key={index}>
                        Week {item.week}: {item.task}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>You have completed all required skills!</p>
                )}
              </section>
            )}

            {/* PROGRESS */}
            <section className="card">
              <h2>📈 Learning Progress Tracking</h2>
              <p>Track your learning journey for {career}.</p>

              <h3>
                Completed: {completedCount} / {required.length} Skills
              </h3>

              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>

              <p>
                <strong>{completionPercentage}% Completed</strong>
              </p>

              {required.map((skill) => (
                <div
                  key={skill}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "12px",
                    padding: "14px",
                    marginTop: "12px",
                    border: "1px solid #ddd",
                    borderRadius: "10px"
                  }}
                >
                  <strong>{skill}</strong>

                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <select
                      value={progress[skill] || "Not Started"}
                      onChange={(e) =>
                        setProgress((prev) => ({
                          ...prev,
                          [skill]: e.target.value
                        }))
                      }
                    >
                      <option value="Not Started">Not Started</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                    </select>

                    <button
                      onClick={() => saveProgress(skill)}
                      disabled={savingSkill === skill}
                    >
                      {savingSkill === skill ? "Saving..." : "Save Progress"}
                    </button>
                  </div>
                </div>
              ))}
            </section>

            {/* HISTORY */}
            <section className="card">
              <h2>📜 Previous Analysis History</h2>
              <p>View your previously saved skill analyses.</p>

              <button onClick={() => fetchHistory(student.id)}>
                🔄 Refresh History
              </button>

              {history.length === 0 ? (
                <p>No previous analysis found.</p>
              ) : (
                <div style={{ overflowX: "auto", marginTop: "20px" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      textAlign: "left"
                    }}
                  >
                    <thead>
                      <tr>
                        <th style={{ padding: "12px" }}>Career</th>
                        <th style={{ padding: "12px" }}>Score</th>
                        <th style={{ padding: "12px" }}>Date</th>
                      </tr>
                    </thead>

                    <tbody>
                      {history.map((item) => (
                        <tr key={item.id}>
                          <td style={{ padding: "12px" }}>{item.career}</td>
                          <td style={{ padding: "12px" }}>
                            {item.percentage}%
                          </td>
                          <td style={{ padding: "12px" }}>{item.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <footer>
        <p>© 2026 Student Skill Gap Analyzer</p>
      </footer>
    </div>
  );
}

export default App;