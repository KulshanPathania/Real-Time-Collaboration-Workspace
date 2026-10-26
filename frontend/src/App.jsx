
import { useEffect, useState } from "react";
import {
  FileText,
  Pencil,
  Plus,
  Search,
  LayoutDashboard,
  Clock3,
  Star,
  Users,
  MoreHorizontal,
  ArrowUpRight,
  Sparkles,
  FolderOpen,
  PanelLeftClose,
} from "lucide-react";

import "./App.css";
import DocumentEditor from "./DocumentEditor";
import AuthPage from "./AuthPage.jsx";

const API =
  import.meta.env.VITE_API_URL || "http://localhost:5001";

const DEFAULT_ITEMS = [
  {
    id: 1,
    title: "Project Planning",
    type: "Document",
    updated: "Just now",
    color: "blue",
  },
  {
    id: 2,
    title: "Product Brainstorm",
    type: "Whiteboard",
    updated: "Yesterday",
    color: "purple",
  },
  {
    id: 3,
    title: "Meeting Notes",
    type: "Document",
    updated: "2 days ago",
    color: "green",
  },
];

// --------------------------------------------------
// ORIGINAL WORKSPACE DASHBOARD
// --------------------------------------------------

function Workspace() {
  const [items, setItems] = useState(() => {
    try {
      const savedItems = localStorage.getItem("workspace-items");

      if (savedItems !== null) {
        const parsedItems = JSON.parse(savedItems);

        if (Array.isArray(parsedItems)) {
          return parsedItems;
        }
      }
    } catch (error) {
      console.error("Error loading workspace items:", error);
    }

    return DEFAULT_ITEMS;
  });

  const [selectedDocument, setSelectedDocument] = useState(null);
  const [activeTab, setActiveTab] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(
        "workspace-items",
        JSON.stringify(items)
      );
    } catch (error) {
      console.error("Error saving workspace items:", error);
    }
  }, [items]);

  // Create a document or whiteboard.
  const createItem = (type) => {
    const newItem = {
      id: Date.now(),
      title:
        type === "Document"
          ? "Untitled Document"
          : "Untitled Whiteboard",
      type,
      updated: "Just now",
      color: type === "Document" ? "blue" : "purple",
    };

    setItems((previous) => [newItem, ...previous]);

    if (type === "Document") {
      setSelectedDocument(newItem);
    } else {
      alert("The whiteboard editor will be built in a later module.");
    }
  };

  // Search and filter workspace items.
  const filteredItems = items.filter((item) => {
    const matchesTab =
      activeTab === "All" || item.type === activeTab;

    const matchesSearch = item.title
      .toLowerCase()
      .includes(search.toLowerCase());

    return matchesTab && matchesSearch;
  });

  // Open the document editor.
  if (selectedDocument) {
    return (
      <DocumentEditor
        document={selectedDocument}
        onBack={() => setSelectedDocument(null)}
        onTitleChange={(newTitle) => {
          setItems((previous) =>
            previous.map((item) =>
              item.id === selectedDocument.id
                ? { ...item, title: newTitle }
                : item
            )
          );

          setSelectedDocument((previous) =>
            previous
              ? { ...previous, title: newTitle }
              : previous
          );
        }}
      />
    );
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Sparkles size={22} />
          </div>
          <span>CollabSpace</span>
        </div>

        <div className="workspace-label">
          <div className="workspace-avatar">C</div>
          <div className="workspace-info">
            <strong>My Workspace</strong>
            <span>Free workspace</span>
          </div>
          <MoreHorizontal size={19} />
        </div>

        <div className="nav-heading">WORKSPACE</div>

        <nav className="navigation">
          <button
            className={`nav-item ${
              activeTab === "All" ? "active" : ""
            }`}
            onClick={() => setActiveTab("All")}
          >
            <LayoutDashboard size={18} />
            <span>Overview</span>
          </button>

          <button
            className={`nav-item ${
              activeTab === "Document" ? "active" : ""
            }`}
            onClick={() => setActiveTab("Document")}
          >
            <FileText size={18} />
            <span>Documents</span>
          </button>

          <button
            className={`nav-item ${
              activeTab === "Whiteboard" ? "active" : ""
            }`}
            onClick={() => setActiveTab("Whiteboard")}
          >
            <Pencil size={18} />
            <span>Whiteboards</span>
          </button>

          <button
            className="nav-item"
            onClick={() => setActiveTab("All")}
          >
            <Clock3 size={18} />
            <span>Recent activity</span>
          </button>

          <button
            className="nav-item"
            onClick={() =>
              alert("Starred items will be added in a later update.")
            }
          >
            <Star size={18} />
            <span>Starred</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="invite-card">
            <div className="invite-icon">
              <Users size={20} />
            </div>
            <strong>Work better together</strong>
            <p>
              Invite your teammates to collaborate in real time.
            </p>
            <button
              className="invite-button"
              onClick={() =>
                alert(
                  "Team invitations will be added in a later module."
                )
              }
            >
              Invite teammates <ArrowUpRight size={15} />
            </button>
          </div>

          <div className="profile">
            <div className="profile-avatar">U</div>
            <div className="profile-info">
              <strong>Your Account</strong>
              <span>Personal workspace</span>
            </div>
            <MoreHorizontal size={18} />
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <PanelLeftClose size={18} />
            <span>Workspace</span>
            <span className="breadcrumb-divider">/</span>
            <strong>Overview</strong>
          </div>

          <div className="topbar-right">
            <div className="status-pill">
              <span className="status-dot"></span>
              Workspace ready
            </div>
            <div className="topbar-avatar">U</div>
          </div>
        </header>

        <section className="page-content">
          <div className="welcome-row">
            <div>
              <div className="eyebrow">
                <Sparkles size={15} /> YOUR CREATIVE WORKSPACE
              </div>
              <h1>Good things start here.</h1>
              <p className="welcome-description">
                Bring your ideas together. Create, organize, and
                collaborate with your team in one place.
              </p>
            </div>

            <div className="welcome-decoration">
              <div className="decoration-card decoration-one">
                <FileText size={23} />
              </div>
              <div className="decoration-card decoration-two">
                <Pencil size={23} />
              </div>
              <div className="decoration-card decoration-three">
                <Users size={23} />
              </div>
            </div>
          </div>

          <div className="section-title-row">
            <div>
              <h2>Create something new</h2>
              <p>
                Choose a starting point for your next idea.
              </p>
            </div>
          </div>

          <div className="create-grid">
            <button
              className="create-card document-create"
              onClick={() => createItem("Document")}
            >
              <div className="create-icon document-icon">
                <FileText size={24} />
              </div>
              <div className="create-card-text">
                <strong>New document</strong>
                <span>Write notes, plans, and ideas.</span>
              </div>
              <div className="create-arrow">
                <Plus size={19} />
              </div>
            </button>

            <button
              className="create-card whiteboard-create"
              onClick={() => createItem("Whiteboard")}
            >
              <div className="create-icon whiteboard-icon">
                <Pencil size={24} />
              </div>
              <div className="create-card-text">
                <strong>New whiteboard</strong>
                <span>Sketch, brainstorm, and map ideas.</span>
              </div>
              <div className="create-arrow">
                <Plus size={19} />
              </div>
            </button>
          </div>

          <div className="section-title-row library-heading">
            <div>
              <h2>Your workspace</h2>
              <p>
                Everything you have created, all in one place.
              </p>
            </div>

            <div className="search-box">
              <Search size={17} />
              <input
                type="text"
                placeholder="Search your workspace..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>
          </div>

          <div className="library-toolbar">
            <div className="tabs">
              {["All", "Document", "Whiteboard"].map((tab) => (
                <button
                  key={tab}
                  className={`tab ${
                    activeTab === tab ? "selected" : ""
                  }`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === "All"
                    ? "All items"
                    : tab === "Document"
                      ? "Documents"
                      : "Whiteboards"}

                  <span>
                    {tab === "All"
                      ? items.length
                      : items.filter(
                          (item) => item.type === tab
                        ).length}
                  </span>
                </button>
              ))}
            </div>

            <div className="item-count">
              <FolderOpen size={16} />
              {filteredItems.length} items
            </div>
          </div>

          {filteredItems.length > 0 ? (
            <div className="items-grid">
              {filteredItems.map((item) => (
                <article
                  className="item-card"
                  key={item.id}
                  onClick={() => {
                    if (item.type === "Document") {
                      setSelectedDocument(item);
                    } else {
                      alert(
                        "The whiteboard editor will be built in a later module."
                      );
                    }
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <div className={`item-preview ${item.color}`}>
                    <div className="preview-toolbar">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>

                    {item.type === "Document" ? (
                      <div className="document-preview">
                        <div className="fake-title"></div>
                        <div className="fake-line long"></div>
                        <div className="fake-line medium"></div>
                        <div className="fake-line long"></div>
                        <div className="fake-line short"></div>
                      </div>
                    ) : (
                      <div className="board-preview">
                        <div className="board-note note-one"></div>
                        <div className="board-note note-two"></div>
                        <div className="board-note note-three"></div>
                        <div className="board-line"></div>
                      </div>
                    )}
                  </div>

                  <div className="item-details">
                    <div
                      className={`item-type-icon ${
                        item.type === "Document"
                          ? "blue"
                          : "purple"
                      }`}
                    >
                      {item.type === "Document" ? (
                        <FileText size={17} />
                      ) : (
                        <Pencil size={17} />
                      )}
                    </div>

                    <div className="item-copy">
                      <strong title={item.title}>
                        {item.title}
                      </strong>
                      <span>
                        {item.type} · Updated {item.updated}
                      </span>
                    </div>

                    <button
                      className="item-menu"
                      title="Remove item"
                      aria-label={`Remove ${item.title}`}
                      onClick={(event) => {
                        event.stopPropagation();

                        const confirmed = window.confirm(
                          `Delete "${item.title}" from your workspace?`
                        );

                        if (confirmed) {
                          setItems((previous) =>
                            previous.filter(
                              (entry) => entry.id !== item.id
                            )
                          );
                        }
                      }}
                    >
                      <MoreHorizontal size={19} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">
                <Search size={25} />
              </div>
              <h3>No items found</h3>
              <p>
                Try a different search or create something new.
              </p>
            </div>
          )}

          <footer className="page-footer">
            <span>CollabSpace · Your ideas, together.</span>
            <span>
              More collaboration features coming soon
            </span>
          </footer>
        </section>
      </main>
    </div>
  );
}

// --------------------------------------------------
// AUTHENTICATION + LOGOUT
// --------------------------------------------------

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function checkLogin() {
      try {
        const response = await fetch(`${API}/api/auth/me`, {
          method: "GET",
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user || null);
        } else {
          setUser(null);
        }
      } catch (err) {
        setError(
          "Cannot connect to the server. Please start your backend."
        );
      } finally {
        setLoading(false);
      }
    }

    checkLogin();
  }, []);

  async function handleLogout() {
    try {
      const response = await fetch(`${API}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        setError("Logout failed. Please try again.");
        return;
      }

      setUser(null);
      setError("");
    } catch (err) {
      setError("Cannot connect to the server. Please try again.");
    }
  }

  if (loading) {
    return <div style={{ padding: 30 }}>Checking login...</div>;
  }

  if (!user) {
    return (
      <>
        {error && (
          <div
            style={{
              padding: 12,
              color: "red",
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

        <AuthPage
          onAuthenticated={(loggedInUser) => {
            setUser(loggedInUser);
            setError("");
          }}
        />
      </>
    );
  }

  return (
    <div>
      <header
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 16,
          padding: "10px 24px",
          background: "#ffffff",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <span>
          Welcome, {user.name || user.email || "User"}
        </span>

        <button
          onClick={handleLogout}
          style={{
            padding: "8px 16px",
            border: "none",
            borderRadius: 6,
            background: "#dc2626",
            color: "#ffffff",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </header>

      {error && (
        <div style={{ padding: 12, color: "red" }}>
          {error}
        </div>
      )}

      <Workspace />
    </div>
  );
}
