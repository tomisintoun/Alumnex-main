"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Users,
  ShieldCheck,
  BriefcaseBusiness,
  Heart,
  GraduationCap,
  ArrowRight,
  Download,
  Sparkles,
  Mail,
  TriangleAlert,
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
  SearchBox,
  date,
  money,
  statusTone,
} from "./ui";
import { DataState, Title } from "./network-views";
import { SimpleForm } from "./forms";
const tabs = [
  ["overview", "Overview"],
  ["users", "Alumni management"],
  ["moderation", "Moderation"],
  ["analytics", "Analytics"],
  ["insights", "Intelligence"],
  ["mentorships", "Mentorships"],
  ["communications", "Communications"],
  ["support", "Support"],
  ["audit", "Audit log"],
];
export function AdminView({ tab }: { tab: string }) {
  const { user } = useApp();
  if (user!.role !== "admin")
    return <ErrorBox message="Administrator access required." />;
  return (
    <>
      <Title
        title="ABUAD Alumni Intelligence"
        subtitle="Understand, engage and activate your university’s global alumni network."
      />
      <nav className="tabs admin-tabs" aria-label="Administration">
        {tabs.map(([slug, label]) => (
          <Link
            href={"/app/admin/" + slug}
            className={tab === slug ? "active" : ""}
            key={slug}
          >
            {label}
          </Link>
        ))}
      </nav>
      {tab === "overview" ? (
        <Overview />
      ) : tab === "users" ? (
        <UsersAdmin />
      ) : tab === "moderation" ? (
        <Moderation />
      ) : tab === "analytics" || tab === "insights" ? (
        <Analytics ai={tab === "insights"} />
      ) : tab === "communications" ? (
        <Communications />
      ) : tab === "support" ? (
        <SupportAdmin />
      ) : tab === "mentorships" ? (
        <MentorshipAdmin />
      ) : tab === "audit" ? (
        <AuditAdmin />
      ) : (
        <Empty body="Choose an administration area to continue." />
      )}
    </>
  );
}
function Overview() {
  const state = useData("admin/overview");
  const c = state.data?.counts || {};
  return (
    <DataState state={state}>
      <div className="grid three metrics">
        {[
          [Users, "Members", c.users],
          [ShieldCheck, "Awaiting verification", c.pending],
          [BriefcaseBusiness, "Pending content", c.content],
          [GraduationCap, "Active mentorships", c.mentorships],
          [FileIcon, "Applications", c.applications],
          [Heart, "Confirmed giving", money((c.raised || 0) / 100)],
        ].map(([Icon, label, value], i) => {
          const I = Icon as typeof Users;
          return (
            <Card key={i}>
              <div className="row between">
                <span>{String(label)}</span>
                <I size={20} />
              </div>
              <strong className="large-number">{value}</strong>
              <small>Live platform records</small>
            </Card>
          );
        })}
      </div>
      <div className="alert danger">
        <TriangleAlert size={28} />
        <div>
          <h3>Attention required</h3>
          <p>
            {c.pending || 0} profiles await verification · {c.content || 0}{" "}
            listings need review · {c.tickets || 0} support requests are open
          </p>
          <div className="row wrap">
            <Action href="/app/admin/users" tone="danger">
              Review profiles
            </Action>
            <Action href="/app/admin/moderation" tone="secondary">
              Review content
            </Action>
            <Action href="/app/admin/support" tone="secondary">
              Help members
            </Action>
          </div>
        </div>
      </div>
      <Insight
        title="Turn connections into institutional understanding."
        body="Explore verified member profiles, mentorship relationships and confirmed giving. All figures are computed from your database."
        href="/app/admin/insights"
        label="Explore intelligence"
      />
    </DataState>
  );
}
const FileIcon = BriefcaseBusiness;
function UsersAdmin() {
  const state = useData("admin/users"),
    { api, toast, user } = useApp();
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState<Item | null>(null),
    [pending, setPending] = useState(false);
  const items = (state.data?.items || []).filter(
    (u: Item) =>
      (!pending || !u.verified) &&
      (
        u.name +
        " " +
        u.email +
        " " +
        u.profile.faculty +
        " " +
        u.profile.graduation
      )
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="section-heading">
        <div className="filter-bar">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search name, email, faculty or graduation year…"
          />
          <label className="checkbox">
            <input
              type="checkbox"
              checked={pending}
              onChange={(e) => setPending(e.target.checked)}
            />
            Awaiting verification
          </label>
        </div>
        <a href="/api/admin/export" className="button secondary">
          <Download size={16} />
          Export CSV
        </a>
      </div>
      <DataState state={state}>
        {items.length ? (
          <Card>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Role</th>
                    <th>Education</th>
                    <th>Verification</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((u: Item) => (
                    <tr key={u.id}>
                      <td>
                        <div className="row">
                          <Avatar
                            name={u.name}
                            index={u.profile.avatar}
                            size={34}
                          />
                          <div>
                            <strong>{u.name}</strong>
                            <small>{u.email}</small>
                          </div>
                        </div>
                      </td>
                      <td>{u.role}</td>
                      <td>
                        {u.profile.faculty || "—"}
                        <small>{u.profile.graduation}</small>
                      </td>
                      <td>
                        <Badge tone={u.verified ? "green" : "red"}>
                          {u.verified ? "Verified" : "Awaiting review"}
                        </Badge>
                      </td>
                      <td>
                        <Badge tone={statusTone(u.status)}>{u.status}</Badge>
                      </td>
                      <td>
                        <Button
                          tone="secondary"
                          disabled={u.id === user!.id}
                          onClick={() => setSelected(u)}
                        >
                          Manage
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Empty body="No members match these filters." />
        )}
      </DataState>
      {selected ? (
        <Modal
          title={"Manage " + selected.name}
          onClose={() => setSelected(null)}
        >
          <p>
            Confirm this member’s ABUAD affiliation before verification. Role
            and suspension changes revoke their existing sessions.
          </p>
          <SimpleForm
            fields={[
              {
                name: "role",
                label: "Role",
                options: ["student", "alumni", "employer", "admin"],
                value: selected.role,
              },
              {
                name: "status",
                label: "Account status",
                options: ["active", "suspended"],
                value: selected.status,
              },
              {
                name: "verified",
                label: "Verification",
                options: ["Not verified", "Verified"],
                value: selected.verified ? "Verified" : "Not verified",
              },
            ]}
            label="Apply account changes"
            onSubmit={async (f) => {
              if (!confirm("Apply these account and permission changes?"))
                return;
              await api("admin/users/" + selected.id, "PATCH", {
                role: f.role,
                status: f.status,
                verified: f.verified === "Verified",
              });
              setSelected(null);
              state.reload();
              toast("Account updated and audited.");
            }}
          />
        </Modal>
      ) : null}
    </>
  );
}
function Moderation() {
  const state = useData("admin/resources"),
    { api, toast } = useApp();
  const [filter, setFilter] = useState("pending"),
    [error, setError] = useState("");
  async function change(r: Item, status: string) {
    if (
      !confirm(
        status === "published"
          ? "Publish this listing to the ABUAD network?"
          : "Set listing status to " + status + "?",
      )
    )
      return;
    try {
      await api("admin/resources/" + r.id, "PATCH", { status });
      state.reload();
      toast("Listing updated.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const items = (state.data?.items || []).filter(
    (r: Item) => filter === "all" || r.status === filter,
  );
  return (
    <>
      <div className="section-heading">
        <div className="tabs">
          {["pending", "published", "draft", "rejected", "closed", "all"].map(
            (s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={filter === s ? "active" : ""}
              >
                {s}
              </button>
            ),
          )}
        </div>
        <Action href="/app/create/announcement" tone="secondary">
          Create announcement
        </Action>
      </div>
      {error ? <ErrorBox message={error} /> : null}
      <DataState state={state}>
        {items.length ? (
          items.map((r: Item) => (
            <Card key={r.id}>
              <div className="section-heading">
                <div>
                  <Badge>{r.kind}</Badge>
                  <h3>{r.title}</h3>
                  <p>
                    {r.owner_name} · {date(r.created_at)}
                  </p>
                </div>
                <Badge tone={statusTone(r.status)}>{r.status}</Badge>
              </div>
              <p className="preserve">{r.description}</p>
              {r.data.deadline ? (
                <p className="deadline">Deadline: {date(r.data.deadline)}</p>
              ) : null}
              <div className="row wrap">
                <Button onClick={() => change(r, "published")}>
                  Approve & publish
                </Button>
                <Button tone="danger" onClick={() => change(r, "rejected")}>
                  Reject
                </Button>
                <Button tone="secondary" onClick={() => change(r, "closed")}>
                  Close listing
                </Button>
                <Action href={"/app/manage/" + r.id} tone="secondary">
                  Edit details
                </Action>
              </div>
            </Card>
          ))
        ) : (
          <Empty
            title="You’re all caught up."
            body="Content awaiting approval will appear here."
          />
        )}
      </DataState>
    </>
  );
}
function Distribution({
  title,
  data,
}: {
  title: string;
  data: Record<string, number>;
}) {
  const items = Object.entries(data || {}).sort((a, b) => b[1] - a[1]),
    max = Math.max(1, ...items.map(([, v]) => v));
  return (
    <Card>
      <h2>{title}</h2>
      {items.length ? (
        items.map(([name, value]) => (
          <div key={name} className="distribution">
            <div className="row between">
              <span>{name}</span>
              <strong>{value}</strong>
            </div>
            <progress value={value} max={max} />
          </div>
        ))
      ) : (
        <p>There are no verified profile records for this distribution yet.</p>
      )}
    </Card>
  );
}
function Analytics({ ai = false }: { ai?: boolean }) {
  const state = useData("insights");
  const [question, setQuestion] = useState(
      "Which industries employ ABUAD graduates?",
    ),
    [asked, setAsked] = useState(false);
  return (
    <DataState state={state}>
      {ai ? (
        <>
          <Insight
            title="Ask a useful question. Start with verified data."
            body="This release provides database-backed summaries. It does not run a predictive or generative AI model, or estimate donor propensity."
          />
          <Card>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setAsked(true);
              }}
            >
              <Field label="What would you like to understand?">
                <select
                  value={question}
                  onChange={(e) => {
                    setQuestion(e.target.value);
                    setAsked(false);
                  }}
                >
                  {[
                    "Which industries employ ABUAD graduates?",
                    "Where are our alumni concentrated?",
                    "Which faculties are represented in our network?",
                    "How many mentorships are currently active?",
                  ].map((q) => (
                    <option key={q}>{q}</option>
                  ))}
                </select>
              </Field>
              <Button type="submit">
                <Sparkles size={17} />
                Explore records
              </Button>
            </form>
          </Card>
          {asked ? (
            <Card>
              <h2>{question}</h2>
              <p>
                {question.includes("mentorships")
                  ? `${state.data?.mentorships || 0} mentorship relationships are currently active.`
                  : `The distribution below is calculated from ${state.data?.alumni || 0} verified alumni profiles. Missing information is shown as “Not provided”.`}
              </p>
              <small>{state.data?.explanation}</small>
            </Card>
          ) : null}
        </>
      ) : null}
      <div className="grid two">
        <Distribution
          title="Professional distribution"
          data={state.data?.industries}
        />
        <Distribution
          title="Global alumni locations"
          data={state.data?.locations}
        />
        <Distribution
          title="Faculties represented"
          data={state.data?.faculties}
        />
        <Card>
          <h2>Mentorship pathway</h2>
          <div className="journey">
            {[
              "Student goals",
              "Verified alumni",
              "Mentorship request",
              "Active relationship",
              "Goals and outcomes",
            ].map((t) => (
              <div key={t}>
                <i />
                <strong>{t}</strong>
              </div>
            ))}
          </div>
          <Badge>{state.data?.mentorships || 0} active relationships</Badge>
        </Card>
      </div>
    </DataState>
  );
}
function Communications() {
  const { api, toast } = useApp();
  const users = useData("admin/users");
  const [audience, setAudience] = useState({ faculty: "", location: "" }),
    [sent, setSent] = useState<number | null>(null);
  const matches = (users.data?.items || []).filter(
    (u: Item) =>
      u.status === "active" &&
      (!audience.faculty || u.profile.faculty === audience.faculty) &&
      (!audience.location || u.profile.location === audience.location),
  );
  return (
    <>
      <Insight
        title="The right message. The right people."
        body="Send an in-platform announcement to members who match your audience. This action does not send email newsletters."
      />
      <Card className="form-panel">
        <div className="grid two">
          <Field label="Faculty (exact match)">
            <input
              value={audience.faculty}
              maxLength={100}
              placeholder="All faculties"
              onChange={(e) =>
                setAudience((a) => ({ ...a, faculty: e.target.value }))
              }
            />
          </Field>
          <Field label="Location (exact match)">
            <input
              value={audience.location}
              maxLength={100}
              placeholder="All locations"
              onChange={(e) =>
                setAudience((a) => ({ ...a, location: e.target.value }))
              }
            />
          </Field>
        </div>
        <Badge>{matches.length} members in this audience</Badge>
        <SimpleForm
          fields={[
            { name: "title", label: "Announcement title", max: 150 },
            {
              name: "body",
              label: "Your announcement",
              type: "textarea",
              max: 5000,
            },
          ]}
          label="Send in-platform announcement"
          onSubmit={async (d) => {
            if (
              !confirm(
                "Send this announcement to " +
                  matches.length +
                  " matching members?",
              )
            )
              return;
            const result = await api("admin/announcements", "POST", {
              ...d,
              ...audience,
            });
            setSent(result.count);
            toast("Announcement delivered to " + result.count + " members.");
          }}
        />
        {sent !== null ? (
          <div role="status" className="alert success">
            Delivered to {sent} members.
          </div>
        ) : null}
      </Card>
    </>
  );
}
function MentorshipAdmin() {
  const state = useData("admin/mentorships");
  return (
    <DataState state={state}>
      {state.data?.items.length ? (
        <Card>
          <h2>Mentorship relationships</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Mentor</th>
                  <th>Mentee</th>
                  <th>Goal</th>
                  <th>Status</th>
                  <th>Requested</th>
                </tr>
              </thead>
              <tbody>
                {state.data.items.map((m: Item) => (
                  <tr key={m.id}>
                    <td>{m.mentor_name}</td>
                    <td>{m.student_name}</td>
                    <td>{m.data.goal}</td>
                    <td>
                      <Badge tone={statusTone(m.status)}>{m.status}</Badge>
                    </td>
                    <td>{date(m.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Empty
          title="Mentorship starts with a connection."
          body="Requests and active relationships will appear here as members begin mentoring."
        />
      )}
    </DataState>
  );
}
function SupportAdmin() {
  const state = useData("admin/support"),
    { api, toast } = useApp();
  return (
    <DataState state={state}>
      {state.data?.items.length ? (
        state.data.items.map((t: Item) => (
          <Card key={t.id}>
            <div className="section-heading">
              <h3>{t.subject}</h3>
              <Badge tone={statusTone(t.status)}>{t.status}</Badge>
            </div>
            <small>
              {t.name} · {date(t.created_at)}
            </small>
            <p className="preserve">{t.body}</p>
            <SimpleForm
              fields={[
                {
                  name: "response",
                  label: "Your response",
                  type: "textarea",
                  value: t.response || "",
                  max: 5000,
                },
                {
                  name: "status",
                  label: "Ticket status",
                  options: ["open", "closed"],
                  value: t.status,
                },
              ]}
              label="Send support response"
              onSubmit={async (f) => {
                await api("admin/support/" + t.id, "PATCH", f);
                state.reload();
                toast("Support response sent.");
              }}
            />
          </Card>
        ))
      ) : (
        <Empty
          title="Your community is all caught up."
          body="Member support requests will appear here."
        />
      )}
    </DataState>
  );
}
function AuditAdmin() {
  const state = useData("admin/audit");
  return (
    <>
      <div className="alert info">
        <ShieldCheck size={22} />
        <p>
          Audit records are append-only. There are no edit or delete actions.
          Sensitive fields such as passwords, tokens and card details are not
          logged.
        </p>
      </div>
      <DataState state={state}>
        {state.data?.items.length ? (
          <Card>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Actor</th>
                    <th>Event</th>
                    <th>Target</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.items.map((a: Item) => (
                    <tr key={a.id}>
                      <td>
                        {new Date(Number(a.created_at)).toLocaleString("en-NG")}
                      </td>
                      <td>{a.actor_name || "System / anonymous"}</td>
                      <td>
                        <Badge
                          tone={
                            a.event.includes("denied") ||
                            a.event.includes("failed")
                              ? "red"
                              : "blue"
                          }
                        >
                          {a.event.replaceAll("_", " ")}
                        </Badge>
                      </td>
                      <td className="mono">{a.target.slice(0, 36) || "—"}</td>
                      <td>{a.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Empty body="Security and administrative activity will appear here." />
        )}
      </DataState>
    </>
  );
}
