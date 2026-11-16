"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Plus,
  Send,
  ShieldCheck,
  CalendarDays,
  FileText,
  Target,
  MessageSquare,
  Star,
} from "lucide-react";
import { useApp, useData, type Item } from "./app-context";
import {
  Action,
  Avatar,
  Badge,
  Button,
  Card,
  Empty,
  ErrorBox,
  Field,
  Insight,
  Loading,
  Modal,
  date,
  statusTone,
} from "./ui";
import { DataState, Title } from "./network-views";
import { SimpleForm, type FormField } from "./forms";
export function MentorshipRequest({
  mentor,
  close,
}: {
  mentor: Item;
  close: () => void;
}) {
  const { api, toast } = useApp();
  return (
    <Modal title={"Request mentorship · " + mentor.name} onClose={close}>
      <p>
        A thoughtful request helps your mentor understand where you want to go.
      </p>
      <SimpleForm
        fields={[
          {
            name: "reason",
            label: "Why would you like to connect?",
            type: "textarea",
            max: 2000,
          },
          {
            name: "goal",
            label: "What would you like to achieve?",
            type: "textarea",
            max: 2000,
          },
          {
            name: "learn",
            label: "What are you hoping to learn?",
            type: "textarea",
            max: 2000,
          },
          {
            name: "format",
            label: "Meeting format",
            options: ["Video", "Phone", "Chat", "In-person"],
          },
          {
            name: "frequency",
            label: "Meeting frequency",
            options: ["Weekly", "Biweekly", "Monthly"],
          },
        ]}
        label="Send mentorship request"
        onSubmit={async (d) => {
          await api("mentorships", "POST", { ...d, mentorId: mentor.id });
          toast("Request sent. We’ll let you know when your mentor responds.");
          close();
        }}
      />
    </Modal>
  );
}
export function MentorshipView() {
  const state = useData("mentorships"),
    { api, user, toast } = useApp();
  const [error, setError] = useState(""),
    [tab, setTab] = useState("All");
  async function respond(id: string, status: string) {
    try {
      await api("mentorships/" + id, "PATCH", { status });
      state.reload();
      toast("Mentorship updated.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const items = (state.data?.items || []).filter(
    (m: Item) => tab === "All" || m.status === tab,
  );
  return (
    <>
      <Title
        title="A little guidance. A world of difference."
        subtitle="Build a relationship that moves your goals forward."
        action={
          <Action href="/app/mentors">
            Find a mentor
            <ArrowRight size={16} />
          </Action>
        }
      />
      <div className="tabs">
        {["All", "pending", "active", "completed", "declined", "cancelled"].map(
          (t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ),
        )}
      </div>
      {error ? <ErrorBox message={error} /> : null}
      <DataState state={state}>
        {items.length ? (
          <div className="grid two">
            {items.map((m: Item) => (
              <Card key={m.id}>
                <div className="row between">
                  <span className="resource-icon">
                    <GraduationCap />
                  </span>
                  <Badge tone={statusTone(m.status)}>{m.status}</Badge>
                </div>
                <h2>
                  {m.mentor_id === user!.id ? m.student_name : m.mentor_name}
                </h2>
                <p>{m.data.goal}</p>
                <small>
                  {m.data.format} · {m.data.frequency}
                </small>
                <div className="row wrap">
                  {m.status === "pending" && m.mentor_id === user!.id ? (
                    <>
                      <Button onClick={() => respond(m.id, "active")}>
                        Accept request
                      </Button>
                      <Button
                        tone="danger"
                        onClick={() => respond(m.id, "declined")}
                      >
                        Decline
                      </Button>
                    </>
                  ) : null}
                  <Action href={"/app/mentorship/" + m.id} tone="secondary">
                    View mentorship
                  </Action>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Empty
            title="You don’t have to figure it out alone."
            body="Find a mentor who shares your interests, or offer guidance to the next generation."
            href="/app/mentors"
            label="Explore mentors"
          />
        )}
      </DataState>
    </>
  );
}
export function MentorshipDetail({
  id,
  tab = "overview",
}: {
  id: string;
  tab?: string;
}) {
  const state = useData("mentorships/" + id),
    { api, user, toast } = useApp();
  const [kind, setKind] = useState(""),
    [error, setError] = useState("");
  const m = state.data?.item,
    items = state.data?.items || [],
    goals = items.filter((i: Item) => i.kind === "goal"),
    progress = goals.length
      ? Math.round(
          (goals.filter((i: Item) => i.data.done).length / goals.length) * 100,
        )
      : 0;
  const currentKind =
    tab === "goals"
      ? "goal"
      : tab === "sessions"
        ? "session"
        : tab === "resources"
          ? "resource"
          : tab === "feedback"
            ? "feedback"
            : "";
  const list = currentKind
    ? items.filter((i: Item) => i.kind === currentKind)
    : items;
  async function transition(status: string) {
    if (!confirm("Mark this mentorship as " + status + "?")) return;
    try {
      await api("mentorships/" + id, "PATCH", { status });
      state.reload();
      toast("Mentorship updated.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const fields: FormField[] = [
    {
      name: "title",
      label: kind === "feedback" ? "Summary" : "Title",
      max: 300,
    },
    {
      name: "body",
      label: kind === "feedback" ? "What was helpful?" : "Details",
      type: "textarea",
      required: false,
      max: 5000,
    },
    ...(kind === "session"
      ? [{ name: "when", label: "Session date & time", type: "datetime-local" }]
      : []),
    ...(kind === "resource"
      ? [{ name: "url", label: "Secure resource link", type: "url" }]
      : []),
    ...(kind === "feedback"
      ? [
          {
            name: "rating",
            label: "Your rating",
            options: ["5", "4", "3", "2", "1"],
          },
        ]
      : []),
  ];
  return (
    <DataState state={state}>
      {m ? (
        <>
          <Title
            title="Your mentorship journey"
            subtitle={m.data.goal}
            action={<Badge tone={statusTone(m.status)}>{m.status}</Badge>}
          />
          <div className="tabs">
            {["overview", "goals", "sessions", "resources", "feedback"].map(
              (t) => (
                <Link
                  key={t}
                  className={tab === t ? "active" : ""}
                  href={"/app/mentorship/" + id + "/" + t}
                >
                  {t}
                </Link>
              ),
            )}
          </div>
          {error ? <ErrorBox message={error} /> : null}
          <div className="grid detail-columns">
            <div>
              <Card>
                <div className="section-heading">
                  <h2>Prepare for your next chapter</h2>
                  <strong>{progress}%</strong>
                </div>
                <progress value={progress} max={100} />
                <p>
                  {goals.filter((g: Item) => g.data.done).length} of{" "}
                  {goals.length} goals completed
                </p>
                <div className="row wrap">
                  {m.status === "active" ? (
                    <>
                      {[
                        ["Goal", "goal", Target],
                        ["Session", "session", CalendarDays],
                        ["Resource", "resource", FileText],
                      ].map(([name, k, Icon]) => {
                        const I = Icon as typeof Plus;
                        return (
                          <Button
                            key={String(k)}
                            tone="secondary"
                            onClick={() => setKind(String(k))}
                          >
                            <I size={16} />
                            Add {String(name).toLowerCase()}
                          </Button>
                        );
                      })}
                    </>
                  ) : m.status === "completed" &&
                    m.student_id === user!.id &&
                    !items.some((i: Item) => i.kind === "feedback") ? (
                    <Button onClick={() => setKind("feedback")}>
                      <Star size={16} />
                      Share feedback
                    </Button>
                  ) : null}
                </div>
              </Card>
              {list.length ? (
                list.map((i: Item) => (
                  <Card key={i.id}>
                    <div className="section-heading">
                      <Badge>{i.kind}</Badge>
                      {i.data.done ? (
                        <Badge tone="green">Completed</Badge>
                      ) : null}
                    </div>
                    <h3>{i.data.title}</h3>
                    <p className="preserve">{i.data.body}</p>
                    {i.data.when ? (
                      <p>{new Date(i.data.when).toLocaleString("en-NG")}</p>
                    ) : null}
                    {i.data.rating ? (
                      <p className="stars">{"★".repeat(i.data.rating)}</p>
                    ) : null}
                    {i.data.url && /^https:\/\//.test(i.data.url) ? (
                      <a
                        className="button secondary"
                        href={i.data.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open resource
                      </a>
                    ) : null}
                    {i.kind === "goal" && m.status === "active" ? (
                      <Button
                        tone="secondary"
                        onClick={async () => {
                          try {
                            await api("mentorship-items/" + i.id, "PATCH", {
                              ...i.data,
                              done: !i.data.done,
                            });
                            state.reload();
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        {i.data.done ? "Mark as incomplete" : "Complete goal"}
                      </Button>
                    ) : null}
                  </Card>
                ))
              ) : (
                <Empty
                  title="Turn your ambitions into a plan."
                  body="Add goals, schedule sessions and share helpful resources together."
                />
              )}
            </div>
            <Card className="sticky-card">
              <h3>Your shared goal</h3>
              <p>{m.data.goal}</p>
              <p>{m.data.reason}</p>
              <small>
                {m.data.format} · {m.data.frequency}
              </small>
              {m.status === "active" ? (
                <>
                  <Action
                    href={
                      "/app/messages/" +
                      (m.student_id === user!.id ? m.mentor_id : m.student_id)
                    }
                    tone="secondary"
                  >
                    Message
                    <Send size={16} />
                  </Action>
                  <Button
                    tone="secondary"
                    onClick={() => transition("completed")}
                  >
                    Complete mentorship
                  </Button>
                </>
              ) : null}
              {["pending", "active"].includes(m.status) ? (
                <Button tone="danger" onClick={() => transition("cancelled")}>
                  Cancel mentorship
                </Button>
              ) : null}
            </Card>
          </div>
          {kind ? (
            <Modal title={"Add " + kind} onClose={() => setKind("")}>
              <SimpleForm
                fields={fields}
                label={kind === "feedback" ? "Submit feedback" : "Save " + kind}
                onSubmit={async (d) => {
                  await api("mentorships/" + id + "/items", "POST", {
                    kind,
                    title: d.title,
                    body: d.body || "",
                    when: d.when ? new Date(d.when).toISOString() : "",
                    url: d.url || "",
                    done: false,
                    ...(d.rating ? { rating: Number(d.rating) } : {}),
                  });
                  setKind("");
                  state.reload();
                  toast("Saved to your mentorship.");
                }}
              />
            </Modal>
          ) : null}
        </>
      ) : null}
    </DataState>
  );
}
export function ConnectionsView() {
  const state = useData("connections"),
    { user, api, toast } = useApp();
  const [tab, setTab] = useState("accepted"),
    [error, setError] = useState("");
  async function update(c: Item, status: string) {
    if (
      status === "blocked" &&
      !confirm("Block this connection? This will prevent conversation access.")
    )
      return;
    try {
      await api("connections/" + c.id, "PATCH", { status });
      state.reload();
      toast("Connection updated.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const items = (state.data?.items || []).filter((c: Item) => c.status === tab);
  return (
    <>
      <Title
        title="Your people. Your possibilities."
        subtitle="A meaningful network, one connection at a time."
        action={
          <Action href="/app/discover" tone="secondary">
            Discover alumni
          </Action>
        }
      />
      <div className="tabs">
        {[
          ["accepted", "My connections"],
          ["pending", "Pending requests"],
          ["declined", "Declined"],
          ["blocked", "Blocked"],
        ].map(([t, l]) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {l}
          </button>
        ))}
      </div>
      {error ? <ErrorBox message={error} /> : null}
      <DataState state={state}>
        {items.length ? (
          <div className="grid two">
            {items.map((c: Item) => {
              const incoming = c.receiver_id === user!.id,
                peer = incoming ? c.sender_id : c.receiver_id,
                name = incoming ? c.sender_name : c.receiver_name;
              return (
                <Card key={c.id}>
                  <div className="row">
                    <Avatar name={name} />
                    <div>
                      <h3>{name}</h3>
                      <p>
                        {c.status === "pending"
                          ? incoming
                            ? "Wants to connect with you"
                            : "Your request is awaiting a response"
                          : "ABUAD network"}
                      </p>
                    </div>
                  </div>
                  <div className="row wrap">
                    {c.status === "pending" && incoming ? (
                      <>
                        <Button onClick={() => update(c, "accepted")}>
                          Accept
                        </Button>
                        <Button
                          tone="danger"
                          onClick={() => update(c, "declined")}
                        >
                          Decline
                        </Button>
                      </>
                    ) : c.status === "accepted" ? (
                      <Action href={"/app/messages/" + peer}>Message</Action>
                    ) : null}
                    <Action href={"/app/discover/" + peer} tone="secondary">
                      View profile
                    </Action>
                    {c.status !== "blocked" ? (
                      <Button tone="ghost" onClick={() => update(c, "blocked")}>
                        Block
                      </Button>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Empty
            title="Your professional circle starts here."
            body="Discover people who share your interests and send a thoughtful connection request."
            href="/app/discover"
            label="Discover alumni"
          />
        )}
      </DataState>
    </>
  );
}
export function MessagesView({ peer }: { peer?: string }) {
  const state = useData(peer ? "messages?peer=" + peer : "messages"),
    profile = useData(peer ? "directory/" + peer : null),
    { api, user, toast } = useApp();
  const [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const timer = setInterval(state.reload, 8000);
    return () => clearInterval(timer);
  }, [peer, state.reload]);
  useEffect(() => {
    if (
      peer &&
      state.data?.items?.some(
        (m: Item) => !m.read_at && m.receiver_id === user!.id,
      )
    )
      api("messages/" + peer + "/read", "POST", {}).catch(() => {});
  }, [state.data, peer, api, user]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("messages", "POST", { receiverId: peer, body: text });
      setText("");
      state.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const seen = new Set();
  const conversations = (state.data?.items || []).filter((m: Item) => {
    const p = m.sender_id === user!.id ? m.receiver_id : m.sender_id;
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });
  return (
    <>
      <Title
        title="Good conversations open doors."
        subtitle="Your private professional conversations."
        action={
          peer ? (
            <Action href="/app/messages" tone="secondary">
              All messages
            </Action>
          ) : undefined
        }
      />
      {error ? <ErrorBox message={error} /> : null}
      <DataState state={state}>
        {peer ? (
          <div className="conversation-layout">
            <Card className="conversation">
              <header className="conversation-header">
                <Avatar
                  name={profile.data?.user.name || "ABUAD connection"}
                  index={profile.data?.user.profile.avatar}
                />
                <div>
                  <h3>{profile.data?.user.name || "ABUAD connection"}</h3>
                  <small>
                    {profile.data?.user.profile.title || "Private conversation"}
                  </small>
                </div>
                <ShieldCheck size={20} />
              </header>
              <div className="message-list" aria-live="polite">
                {state.data?.items.length ? (
                  [...state.data.items].reverse().map((m: Item) => (
                    <div
                      key={m.id}
                      className={
                        "message " + (m.sender_id === user!.id ? "own" : "")
                      }
                    >
                      <p>{m.body}</p>
                      <small>
                        {new Date(Number(m.created_at)).toLocaleTimeString(
                          "en-NG",
                          { hour: "2-digit", minute: "2-digit" },
                        )}
                        {m.sender_id === user!.id && m.read_at ? " · Read" : ""}
                      </small>
                    </div>
                  ))
                ) : (
                  <div className="conversation-empty">
                    <MessageSquare size={38} />
                    <p>Start a meaningful conversation.</p>
                  </div>
                )}
              </div>
              <form className="message-composer" onSubmit={send}>
                <label className="sr-only" htmlFor="message-input">
                  Write a message
                </label>
                <textarea
                  id="message-input"
                  placeholder="Write a message…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  required
                  maxLength={5000}
                  rows={2}
                />
                <Button busy={busy} disabled={!text.trim()} type="submit">
                  <Send size={18} />
                  <span>Send</span>
                </Button>
              </form>
            </Card>
            <Card className="conversation-context">
              <h3>Your connection</h3>
              {profile.data ? (
                <>
                  <Avatar
                    name={profile.data.user.name}
                    index={profile.data.user.profile.avatar}
                    size={90}
                  />
                  <h3>{profile.data.user.name}</h3>
                  <p>{profile.data.user.profile.company}</p>
                  <Action href={"/app/discover/" + peer} tone="secondary">
                    View profile
                  </Action>
                </>
              ) : null}
              <p className="security-note">
                Messages are visible only to the conversation participants.
                Blocking a connection disables further conversation access.
              </p>
            </Card>
          </div>
        ) : conversations.length ? (
          <div className="list-stack">
            {conversations.map((m: Item) => {
              const outgoing = m.sender_id === user!.id,
                p = outgoing ? m.receiver_id : m.sender_id,
                name = outgoing ? m.receiver_name : m.sender_name;
              return (
                <Link
                  className="conversation-preview card"
                  href={"/app/messages/" + p}
                  key={p}
                >
                  <Avatar name={name} />
                  <div>
                    <h3>{name}</h3>
                    <p>{m.body.slice(0, 120)}</p>
                  </div>
                  <small>{date(m.created_at)}</small>
                  {!outgoing && !m.read_at ? (
                    <Badge tone="red">Unread</Badge>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ) : (
          <Empty
            title="Your next conversation starts with a connection."
            body="Connect with alumni or start a mentorship to send private messages."
            href="/app/connections"
            label="View connections"
          />
        )}
      </DataState>
    </>
  );
}
export function NotificationsView() {
  const state = useData("notifications"),
    { api } = useApp(),
    [error, setError] = useState("");
  return (
    <>
      <Title
        title="Your network, keeping you in the loop."
        action={
          <Button
            tone="secondary"
            onClick={async () => {
              try {
                await api("notifications/read", "POST", {});
                state.reload();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Mark all as read
          </Button>
        }
      />
      {error ? <ErrorBox message={error} /> : null}
      <DataState state={state}>
        {state.data?.items.length ? (
          state.data.items.map((n: Item) => (
            <Link
              className={
                "card notification-item " + (!n.read_at ? "unread" : "")
              }
              key={n.id}
              href={n.href}
            >
              <div className="section-heading">
                <h3>{n.title}</h3>
                {!n.read_at ? <Badge tone="red">New</Badge> : null}
              </div>
              <p>{n.body}</p>
              <small>{date(n.created_at)}</small>
            </Link>
          ))
        ) : (
          <Empty
            title="You’re all caught up."
            body="Connections, mentorships, opportunities and university updates will appear here."
          />
        )}
      </DataState>
    </>
  );
}
export function SettingsView({ privacy = false }: { privacy?: boolean }) {
  const { user, api, refresh, toast } = useApp(),
    router = useRouter();
  const p = user!.profile;
  const [mentor, setMentor] = useState(p.mentorAvailable);
  const fields: FormField[] = privacy
    ? []
    : [
        { name: "name", label: "Full name", value: user!.name, max: 100 },
        {
          name: "title",
          label: "Professional title",
          value: p.title,
          required: false,
          max: 150,
        },
        {
          name: "company",
          label: "Company / organization",
          value: p.company,
          required: false,
          max: 150,
        },
        {
          name: "faculty",
          label: "Faculty",
          value: p.faculty,
          required: false,
          max: 100,
        },
        {
          name: "department",
          label: "Department",
          value: p.department,
          required: false,
          max: 100,
        },
        {
          name: "graduation",
          label: "Graduation / expected graduation year",
          value: p.graduation,
          required: false,
          max: 4,
        },
        {
          name: "level",
          label: "Student level",
          value: p.level,
          required: false,
          max: 30,
        },
        {
          name: "location",
          label: "Location",
          value: p.location,
          required: false,
          max: 100,
        },
        {
          name: "industry",
          label: "Industry",
          value: p.industry,
          required: false,
          max: 100,
        },
        {
          name: "bio",
          label: "Your professional story",
          value: p.bio,
          type: "textarea",
          required: false,
          max: 3000,
        },
        {
          name: "skills",
          label: "Skills (comma separated)",
          value: p.skills.join(", "),
          required: false,
          max: 1500,
        },
        {
          name: "interests",
          label: "Interests (comma separated)",
          value: p.interests.join(", "),
          required: false,
          max: 1500,
        },
      ];
  fields.push(
    {
      name: "visibility",
      label: "Profile visibility",
      options: ["network", "connections", "private"],
      value: p.visibility,
    },
    {
      name: "messages",
      label: "Who can message me?",
      options: ["connections", "network", "nobody"],
      value: p.messages,
    },
  );
  return (
    <>
      <Title
        title={
          privacy
            ? "Your privacy. Your choice."
            : "Make your profile tell your story."
        }
        subtitle="Your role and verification status are managed by ABUAD administrators."
      />
      <div className="tabs">
        <Link className={!privacy ? "active" : ""} href="/app/settings">
          Profile
        </Link>
        <Link className={privacy ? "active" : ""} href="/app/privacy">
          Privacy & security
        </Link>
      </div>
      <Card className="form-panel">
        <SimpleForm
          key={privacy ? "privacy" : "profile"}
          fields={fields}
          label="Save changes"
          onSubmit={async (f) => {
            const next = {
              ...p,
              ...(privacy
                ? {}
                : {
                    ...f,
                    skills: (f.skills || "")
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                    interests: (f.interests || "")
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  }),
              visibility: f.visibility,
              messages: f.messages,
              mentorAvailable: mentor,
              online: true,
              name: privacy ? user!.name : f.name,
            };
            await api("profile", "PATCH", next);
            await refresh();
            toast("Your profile has been updated.");
          }}
        >
          {user!.role === "alumni" ? (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={mentor}
                onChange={(e) => setMentor(e.target.checked)}
              />
              I’m available to mentor ABUAD students
            </label>
          ) : null}
          <div className="alert info">
            <ShieldCheck size={18} />
            <p>
              {user!.verified
                ? "Your ABUAD profile is verified."
                : "Your profile is awaiting administrator verification."}{" "}
              Visibility choices take effect immediately after saving.
            </p>
          </div>
        </SimpleForm>
      </Card>
      {privacy ? (
        <Card className="form-panel">
          <h2>Change password</h2>
          <SimpleForm
            fields={[
              {
                name: "current",
                label: "Current password",
                type: "password",
                max: 72,
              },
              {
                name: "password",
                label: "New password (10–72 characters)",
                type: "password",
                max: 72,
              },
            ]}
            label="Change password and sign out"
            onSubmit={async (f) => {
              await api("profile/password", "POST", f);
              router.replace("/login");
            }}
          />
          <p>
            <Link href="/security">Read how ALUMNEX protects your account</Link>
          </p>
        </Card>
      ) : null}
    </>
  );
}
export function SupportView() {
  const state = useData("support"),
    { api, toast } = useApp();
  return (
    <>
      <Title
        title="A little help when you need it."
        subtitle="Contact your ABUAD administrator for account, verification or platform support."
      />
      <div className="grid two">
        <Card>
          <h2>How can we help?</h2>
          <SimpleForm
            fields={[
              { name: "subject", label: "Subject", max: 200 },
              {
                name: "body",
                label: "Tell us what happened",
                type: "textarea",
                max: 5000,
              },
            ]}
            label="Send support request"
            onSubmit={async (d, form) => {
              await api("support", "POST", d);
              form.reset();
              state.reload();
              toast("Support request sent.");
            }}
          />
        </Card>
        <div>
          <DataState state={state}>
            {state.data?.items.length ? (
              state.data.items.map((t: Item) => (
                <Card key={t.id}>
                  <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                  <h3>{t.subject}</h3>
                  <p>{t.body}</p>
                  {t.response ? (
                    <div className="support-reply">
                      <strong>ABUAD support</strong>
                      <p>{t.response}</p>
                    </div>
                  ) : (
                    <small>Awaiting a response.</small>
                  )}
                </Card>
              ))
            ) : (
              <Empty
                title="You’re in good company."
                body="Your support requests and administrator replies will appear here."
              />
            )}
          </DataState>
        </div>
      </div>
    </>
  );
}
