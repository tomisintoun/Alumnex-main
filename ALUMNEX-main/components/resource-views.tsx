"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Upload,
  FileText,
  Heart,
  Plus,
  ThumbsUp,
  Users,
  CalendarDays,
  BriefcaseBusiness,
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
  Loading,
  Modal,
  SearchBox,
  date,
  money,
  statusTone,
} from "./ui";
import { DataState, PersonCard, ResourceCard, Title } from "./network-views";
import { SimpleForm, type FormField } from "./forms";
export function ApplyView({ id }: { id: string }) {
  const state = useData("resources/" + id),
    { user, api, toast } = useApp();
  const [step, setStep] = useState(1),
    [resume, setResume] = useState<Item | null>(null),
    [answers, setAnswers] = useState(""),
    [availability, setAvailability] = useState(""),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  const steps = [
    "Opportunity",
    "Profile",
    "Resume",
    "Questions",
    "Review",
    "Submit",
  ];
  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      if (
        file.size > 2 * 1024 * 1024 ||
        !file.name.toLowerCase().endsWith(".pdf")
      )
        throw new Error("Choose a PDF file of up to 2 MB.");
      const content = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1]);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const d = await api("files", "POST", { name: file.name, content });
      setResume(d);
      toast("Resume uploaded privately.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    setBusy(true);
    setError("");
    try {
      await api("apply/" + id, "POST", {
        answers,
        availability,
        resumeId: resume!.id,
        consent,
      });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <>
        <Title title="Application submitted." />
        <Card className="success-page">
          <CheckCircle2 size={58} />
          <h2>Your next chapter is on its way.</h2>
          <p>{state.data?.item.title}</p>
          <Badge>Submitted</Badge>
          <Action href="/app/applications">
            View my applications
            <ArrowRight size={16} />
          </Action>
        </Card>
      </>
    );
  return (
    <DataState state={state}>
      <Title title="Make your next move." subtitle={state.data?.item.title} />
      <ol className="stepper">
        {steps.map((s, i) => (
          <li
            key={s}
            className={
              step === i + 1 ? "current" : step > i + 1 ? "complete" : ""
            }
          >
            <span>{step > i + 1 ? "✓" : i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      {error ? <ErrorBox message={error} /> : null}
      <Card className="application-panel">
        <span className="eyebrow">STEP {step} OF 6</span>
        <h2>{steps[step - 1]}</h2>
        {step === 1 ? (
          <>
            <h3>{state.data?.item.title}</h3>
            <p>{state.data?.item.description}</p>
            <Badge>{state.data?.item.data.type}</Badge>
            <p>Deadline: {date(state.data?.item.data.deadline)}</p>
          </>
        ) : step === 2 ? (
          <>
            <p>Your submitted application includes this profile snapshot.</p>
            <dl>
              <dt>Name</dt>
              <dd>{user!.name}</dd>
              <dt>Email</dt>
              <dd>{user!.email}</dd>
              <dt>Education</dt>
              <dd>
                {user!.profile.faculty} · {user!.profile.department}
              </dd>
              <dt>Skills</dt>
              <dd>{user!.profile.skills.join(", ") || "Not added yet"}</dd>
            </dl>
            <Link href="/app/settings">
              Update your profile before continuing
            </Link>
          </>
        ) : step === 3 ? (
          <>
            <div className="upload-box">
              <Upload size={34} />
              <h3>Upload your resume</h3>
              <p>
                PDF only · Up to 2 MB · Shared only with the authorized employer
              </p>
              <input
                aria-label="Upload resume PDF"
                type="file"
                accept="application/pdf,.pdf"
                disabled={busy}
                onChange={(e) => {
                  if (e.target.files?.[0]) upload(e.target.files[0]);
                }}
              />
              {resume ? (
                <div className="alert success">
                  <FileText size={19} />
                  {resume.name} · Ready to submit
                </div>
              ) : null}
            </div>
          </>
        ) : step === 4 ? (
          <>
            <Field label="Why are you interested in this opportunity?">
              <textarea
                rows={6}
                maxLength={10000}
                value={answers}
                onChange={(e) => setAnswers(e.target.value)}
              />
            </Field>
            <Field label="When can you start?">
              <input
                maxLength={100}
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
                placeholder="Your availability"
              />
            </Field>
          </>
        ) : step === 5 ? (
          <>
            <h3>{user!.name}</h3>
            <p>{user!.email}</p>
            <p>
              <FileText size={16} /> {resume?.name}
            </p>
            <h3>Your response</h3>
            <p className="preserve">{answers}</p>
            <p>Availability: {availability}</p>
          </>
        ) : (
          <>
            <h3>Ready for your next chapter?</h3>
            <p>
              By submitting, you share your profile snapshot, answers and
              selected resume with this opportunity’s authorized reviewer.
            </p>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              I consent to sharing this application with the employer.
            </label>
          </>
        )}
        <div className="row between wizard-actions">
          <Button
            tone="secondary"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 1 || busy}
          >
            <ArrowLeft size={16} />
            Back
          </Button>
          {step < 6 ? (
            <Button
              busy={busy}
              disabled={
                (step === 3 && !resume) ||
                (step === 4 && (!answers.trim() || !availability.trim()))
              }
              onClick={() => setStep((s) => s + 1)}
            >
              Continue
              <ArrowRight size={16} />
            </Button>
          ) : (
            <Button busy={busy} disabled={!consent || !resume} onClick={submit}>
              Submit application
              <ArrowRight size={16} />
            </Button>
          )}
        </div>
      </Card>
    </DataState>
  );
}
export function ApplicationsView({ managed = false }: { managed?: boolean }) {
  const state = useData("applications" + (managed ? "?managed=1" : "")),
    { api, toast } = useApp();
  const [filter, setFilter] = useState("All"),
    [selected, setSelected] = useState<Item | null>(null),
    [error, setError] = useState("");
  async function change(a: Item, status: string) {
    if (
      !confirm("Change application status to " + status.replace("_", " ") + "?")
    )
      return;
    try {
      await api("applications/" + a.id, "PATCH", { status });
      state.reload();
      setSelected(null);
      toast("Application updated.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const items = (state.data?.items || []).filter(
    (a: Item) => filter === "All" || a.status === filter,
  );
  return (
    <>
      <Title
        title={managed ? "Applications received" : "My applications"}
        subtitle={
          managed
            ? "Review the talent in your ABUAD network."
            : "Track every step towards your next opportunity."
        }
      />
      <div className="tabs">
        {[
          "All",
          "submitted",
          "under_review",
          "interview",
          "accepted",
          "rejected",
          "withdrawn",
        ].map((s) => (
          <button
            className={filter === s ? "active" : ""}
            key={s}
            onClick={() => setFilter(s)}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>
      {error ? <ErrorBox message={error} /> : null}
      <DataState state={state}>
        {items.length ? (
          <div className="list-stack">
            {items.map((a: Item) => (
              <Card key={a.id}>
                <div className="section-heading">
                  <div>
                    <h3>{a.title}</h3>
                    <p>
                      {managed
                        ? a.applicant_name
                        : "Submitted " + date(a.created_at)}
                    </p>
                  </div>
                  <Badge tone={statusTone(a.status)}>
                    {a.status.replace("_", " ")}
                  </Badge>
                </div>
                <div className="row wrap">
                  <Button tone="secondary" onClick={() => setSelected(a)}>
                    View application
                  </Button>
                  {!managed && a.status !== "withdrawn" ? (
                    <Button
                      tone="danger"
                      onClick={() => change(a, "withdrawn")}
                    >
                      Withdraw
                    </Button>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Empty
            title="Your next chapter starts with an application."
            body={
              managed
                ? "Applications for your opportunities will appear here."
                : "Find an opportunity that fits your interests and take the first step."
            }
            href="/app/opportunities"
            label="Explore opportunities"
          />
        )}
      </DataState>
      {selected ? (
        <Modal title="Application details" onClose={() => setSelected(null)}>
          <h3>{selected.title}</h3>
          <p>{selected.applicant_name}</p>
          <Badge tone={statusTone(selected.status)}>
            {selected.status.replace("_", " ")}
          </Badge>
          <h3>Applicant profile</h3>
          <p>
            {selected.data.profile?.name} · {selected.data.profile?.email}
          </p>
          <p>{selected.data.profile?.profile?.department}</p>
          <h3>Application answers</h3>
          <p className="preserve">{selected.data.answers}</p>
          <p>Availability: {selected.data.availability}</p>
          <a
            className="button secondary"
            href={"/api/files/" + selected.data.resumeId}
          >
            Download authorized resume
          </a>
          {managed && selected.status !== "withdrawn" ? (
            <div className="row wrap">
              {["under_review", "interview", "accepted", "rejected"].map(
                (s) => (
                  <Button
                    key={s}
                    tone={s === "rejected" ? "danger" : "secondary"}
                    onClick={() => change(selected, s)}
                  >
                    {s.replace("_", " ")}
                  </Button>
                ),
              )}
            </div>
          ) : null}
        </Modal>
      ) : null}
    </>
  );
}
export function EventRegistrationView({ id }: { id: string }) {
  const state = useData("resources/" + id),
    { api } = useApp();
  const [done, setDone] = useState(false);
  return (
    <DataState state={state}>
      {done ? (
        <Card className="success-page">
          <CheckCircle2 size={56} />
          <h1>You’re going!</h1>
          <p>
            {state.data?.item.title} · {date(state.data?.item.data.startsAt)}
          </p>
          <Action href={"/app/events/" + id}>View event</Action>
        </Card>
      ) : (
        <>
          <Title title="Save your place." subtitle={state.data?.item.title} />
          <Card className="form-panel">
            <SimpleForm
              fields={[
                { name: "phone", label: "Phone number", type: "tel", max: 30 },
                { name: "role", label: "Professional role", max: 120 },
                {
                  name: "attendance",
                  label: "Attendance type",
                  options: ["In-person", "Virtual"],
                },
                {
                  name: "dietary",
                  label: "Dietary requirements",
                  required: false,
                  max: 300,
                },
                {
                  name: "networking",
                  label: "Networking preferences",
                  type: "textarea",
                  required: false,
                  max: 500,
                },
              ]}
              label="Complete registration"
              onSubmit={async (d) => {
                await api("register/" + id, "POST", d);
                setDone(true);
              }}
            />
          </Card>
        </>
      )}
    </DataState>
  );
}
export function CommunityView({
  id,
  tab = "feed",
}: {
  id: string;
  tab?: string;
}) {
  const state = useData("resources/" + id),
    membership = useData("communities/" + id + "/membership"),
    posts = useData(tab === "feed" ? "communities/" + id + "/posts" : null),
    { api, toast } = useApp();
  const [error, setError] = useState(""),
    [posting, setPosting] = useState(false);
  async function join() {
    try {
      await api(
        "communities/" + id + "/membership",
        membership.data?.member ? "DELETE" : "POST",
        {},
      );
      membership.reload();
      toast(
        membership.data?.member
          ? "You left the community."
          : "Welcome to the community.",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <DataState state={state}>
      {state.data ? (
        <>
          <Title
            title={state.data.item.title}
            subtitle={`${state.data.members} members · ABUAD community`}
            action={
              <Button
                tone={membership.data?.member ? "secondary" : "primary"}
                onClick={join}
              >
                {membership.data?.member
                  ? "Joined — leave community"
                  : "Join community"}
              </Button>
            }
          />
          <p className="preserve">{state.data.item.description}</p>
          <div className="tabs">
            {["feed", "members", "events", "opportunities", "about"].map(
              (t) => (
                <Link
                  key={t}
                  className={tab === t ? "active" : ""}
                  href={"/app/communities/" + id + "/" + t}
                >
                  {t}
                </Link>
              ),
            )}
          </div>
          {error ? <ErrorBox message={error} /> : null}
          {tab === "members" ? (
            <DataState state={membership}>
              {membership.data?.members.length ? (
                <div className="grid three">
                  {membership.data.members.map((p: Item) => (
                    <PersonCard key={p.id} person={p} />
                  ))}
                </div>
              ) : (
                <Empty body="Members who have opted into network visibility will appear here." />
              )}
            </DataState>
          ) : tab === "events" || tab === "opportunities" ? (
            <RelatedResources
              community={state.data.item}
              kind={tab === "events" ? "event" : "opportunity"}
            />
          ) : tab === "about" ? (
            <Card>
              <h2>About this ABUAD community</h2>
              <p className="preserve">{state.data.item.description}</p>
              <h3>Community guidelines</h3>
              <p>
                Be respectful, protect personal information, and keep
                conversations relevant to this professional community.
              </p>
            </Card>
          ) : (
            <>
              <Card>
                <SimpleForm
                  fields={[
                    {
                      name: "body",
                      label: "Share with your community",
                      type: "textarea",
                      max: 5000,
                    },
                  ]}
                  label="Publish post"
                  onSubmit={async (d, form) => {
                    await api("communities/" + id + "/posts", "POST", d);
                    form.reset();
                    posts.reload();
                  }}
                />
              </Card>
              <DataState state={posts}>
                {posts.data?.items.length ? (
                  posts.data.items.map((p: Item) => (
                    <Card key={p.id}>
                      <div className="row">
                        <Avatar name={p.name} size={40} />
                        <div>
                          <strong>{p.name}</strong>
                          <small>{date(p.created_at)}</small>
                        </div>
                      </div>
                      <p className="preserve">{p.body}</p>
                      <Button
                        tone="ghost"
                        onClick={async () => {
                          try {
                            await api("posts/" + p.id + "/like", "POST", {});
                            posts.reload();
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        <ThumbsUp size={16} />
                        {p.likes} likes
                      </Button>
                    </Card>
                  ))
                ) : (
                  <Empty
                    title="Start something meaningful."
                    body="Be the first to share a question, insight or opportunity with the community."
                  />
                )}
              </DataState>
            </>
          )}
        </>
      ) : null}
    </DataState>
  );
}
function RelatedResources({
  community,
  kind,
}: {
  community: Item;
  kind: string;
}) {
  const state = useData("resources?kind=" + kind);
  const items = (state.data?.items || []).filter(
    (r: Item) => r.data.industry && r.data.industry === community.data.industry,
  );
  return (
    <DataState state={state}>
      {items.length ? (
        <div className="grid two">
          {items.map((r: Item) => (
            <ResourceCard key={r.id} item={r} />
          ))}
        </div>
      ) : (
        <Empty body="Relevant opportunities and events will appear when published in this community’s industry." />
      )}
    </DataState>
  );
}
export function DonationForm({ campaignId }: { campaignId: string }) {
  const { api } = useApp();
  const [amount, setAmount] = useState(25000),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function checkout() {
    setBusy(true);
    setError("");
    try {
      const d = await api("giving/checkout", "POST", { campaignId, amount });
      window.location.assign(d.url);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <>
      <p>
        Your contribution supports the next generation of ABUAD professionals.
      </p>
      {error ? <ErrorBox message={error} /> : null}
      <div className="amount-options">
        {[5000, 10000, 25000, 50000].map((n) => (
          <button
            key={n}
            className={amount === n ? "active" : ""}
            onClick={() => setAmount(n)}
          >
            {money(n)}
          </button>
        ))}
      </div>
      <Field label="Donation amount (NGN)">
        <input
          type="number"
          min={100}
          max={10000000}
          value={amount || ""}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
      </Field>
      <p className="security-note">
        You’ll continue to Paystack’s secure checkout. No card details are
        stored by ALUMNEX.
      </p>
      <Button
        busy={busy}
        onClick={checkout}
        disabled={
          !Number.isInteger(amount) || amount < 100 || amount > 10000000
        }
      >
        Continue to secure checkout
        <Heart size={16} />
      </Button>
    </>
  );
}
export function GivingView({ confirm = false }: { confirm?: boolean }) {
  const state = useData("giving"),
    { api, toast } = useApp(),
    params = useSearchParams();
  const [checking, setChecking] = useState(false),
    [error, setError] = useState("");
  const total = (state.data?.items || [])
    .filter((d: Item) => d.status === "paid")
    .reduce((sum: number, d: Item) => sum + Number(d.amount) / 100, 0);
  async function verify() {
    setChecking(true);
    try {
      await api("giving/verify", "POST", {
        reference: params.get("reference") || "",
      });
      state.reload();
      toast("Your donation is confirmed. Thank you for giving back to ABUAD.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }
  return (
    <>
      <Title
        title={
          confirm
            ? "Confirm your contribution"
            : "Your giving makes a difference."
        }
        subtitle="Thank you for supporting the next generation."
      />
      {confirm ? (
        <Card>
          <h2>Confirm your payment</h2>
          <p>
            We verify the provider’s payment record before issuing your receipt.
          </p>
          <Button busy={checking} onClick={verify}>
            Verify payment
          </Button>
        </Card>
      ) : null}
      {error ? <ErrorBox message={error} /> : null}
      <DataState state={state}>
        <div className="grid three">
          <Card>
            <span className="eyebrow">TOTAL CONFIRMED GIVING</span>
            <strong className="large-number">{money(total)}</strong>
          </Card>
          <Card>
            <span className="eyebrow">CAMPAIGNS SUPPORTED</span>
            <strong className="large-number">
              {
                new Set(
                  (state.data?.items || [])
                    .filter((d: Item) => d.status === "paid")
                    .map((d: Item) => d.campaign_id),
                ).size
              }
            </strong>
          </Card>
          <Card>
            <h3>Keep opening doors.</h3>
            <Action href="/app/giving" tone="secondary">
              Explore campaigns
            </Action>
          </Card>
        </div>
        {state.data?.items.length ? (
          <Card>
            <h2>Giving history & receipts</h2>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.items.map((d: Item) => (
                    <tr key={d.id}>
                      <td>{d.title}</td>
                      <td>{money(d.amount / 100)}</td>
                      <td>{date(d.created_at)}</td>
                      <td>
                        <Badge tone={statusTone(d.status)}>{d.status}</Badge>
                      </td>
                      <td>
                        {d.status === "paid" ? (
                          <button
                            className="text-button"
                            onClick={() => {
                              const a = document.createElement("a");
                              a.href = URL.createObjectURL(
                                new Blob(
                                  [
                                    `ALUMNEX · ABUAD donation receipt\nReference: ${d.reference}\nCampaign: ${d.title}\nAmount: ${money(d.amount / 100)}\nConfirmed: ${date(d.paid_at)}\nStatus: Paid\n`,
                                  ],
                                  { type: "text/plain" },
                                ),
                              );
                              a.download =
                                "alumnex-receipt-" + d.reference + ".txt";
                              a.click();
                              URL.revokeObjectURL(a.href);
                            }}
                          >
                            Download receipt
                          </button>
                        ) : (
                          <span>Pending confirmation</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Empty
            title="Your impact starts here."
            body="Your confirmed contributions and receipts will appear here."
            href="/app/giving"
            label="Support a campaign"
          />
        )}
      </DataState>
    </>
  );
}
export function ManageView() {
  const { user } = useApp();
  const kinds =
    user!.role === "admin"
      ? ["opportunity", "event", "community", "campaign", "announcement"]
      : user!.role === "employer"
        ? ["opportunity"]
        : ["opportunity", "event", "community"];
  const [kind, setKind] = useState(kinds[0]);
  const state = useData("resources?kind=" + kind + "&mine=1");
  return (
    <>
      <Title
        title="Your ABUAD workspace"
        subtitle="Create and manage the opportunities you bring to the network."
        action={
          <Action href={"/app/create/" + kind}>
            <Plus size={16} />
            Create {kind}
          </Action>
        }
      />
      <div className="tabs">
        {kinds.map((k) => (
          <button
            className={kind === k ? "active" : ""}
            key={k}
            onClick={() => setKind(k)}
          >
            {k}
          </button>
        ))}
      </div>
      <DataState state={state}>
        {state.data?.items.length ? (
          <div className="list-stack">
            {state.data.items.map((r: Item) => (
              <Card key={r.id}>
                <div className="section-heading">
                  <h3>{r.title}</h3>
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                </div>
                <p>{date(r.updated_at)}</p>
                <Action href={"/app/manage/" + r.id} tone="secondary">
                  Edit details
                </Action>
              </Card>
            ))}
          </div>
        ) : (
          <Empty
            title="What will you bring to the network?"
            body="Create an opportunity, event or community and submit it for administrator review."
            href={"/app/create/" + kind}
            label={"Create " + kind}
          />
        )}
      </DataState>
    </>
  );
}
export function CreateResourceView({
  kind,
  editId,
}: {
  kind: string;
  editId?: string;
}) {
  const state = useData(editId ? "resources/" + editId : null),
    { api, user, toast } = useApp(),
    router = useRouter();
  const r = state.data?.item,
    d = r?.data || {},
    actualKind = r?.kind || kind;
  const fields: FormField[] = [
    { name: "title", label: "Title", max: 160, value: r?.title },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      max: 15000,
      value: r?.description,
    },
    { name: "location", label: "Location", required: false, value: d.location },
    { name: "industry", label: "Industry", required: false, value: d.industry },
  ];
  if (actualKind === "opportunity")
    fields.push(
      {
        name: "type",
        label: "Type",
        options: [
          "Job",
          "Internship",
          "Fellowship",
          "Scholarship",
          "Research",
          "Volunteer",
          "Entrepreneurship",
        ],
        value: d.type,
      },
      {
        name: "arrangement",
        label: "Work arrangement",
        options: ["Remote", "Hybrid", "On-site"],
        value: d.arrangement,
      },
      {
        name: "salary",
        label: "Salary / benefits",
        required: false,
        value: d.salary,
      },
      {
        name: "skills",
        label: "Skills (comma separated)",
        required: false,
        value: d.skills?.join(", "),
      },
    );
  if (["opportunity", "event", "campaign"].includes(actualKind))
    fields.push({
      name: "deadline",
      label: "Deadline",
      type: "datetime-local",
      required: actualKind !== "campaign",
      value: d.deadline?.slice(0, 16),
    });
  if (actualKind === "event")
    fields.push(
      {
        name: "startsAt",
        label: "Start date & time",
        type: "datetime-local",
        value: d.startsAt?.slice(0, 16),
      },
      {
        name: "endsAt",
        label: "End date & time",
        type: "datetime-local",
        required: false,
        value: d.endsAt?.slice(0, 16),
      },
      {
        name: "capacity",
        label: "Capacity",
        type: "number",
        value: String(d.capacity || 100),
      },
    );
  if (actualKind === "campaign")
    fields.push({
      name: "goal",
      label: "Fundraising goal (NGN)",
      type: "number",
      value: String(d.goal || 150000),
    });
  fields.push(
    {
      name: "requirements",
      label:
        actualKind === "event"
          ? "Agenda, speakers and registration details"
          : "Requirements / additional details",
      type: "textarea",
      max: 5000,
      required: false,
      value: d.requirements,
    },
    {
      name: "status",
      label: "Publication status",
      options:
        user!.role === "admin"
          ? ["draft", "published", "closed"]
          : ["draft", "pending", "closed"],
      value:
        r?.status === "published" && user!.role !== "admin"
          ? "pending"
          : r?.status,
    },
  );
  return (
    <>
      <Title
        title={(editId ? "Edit " : "Create ") + actualKind}
        subtitle="All public listings are reviewed by an ABUAD administrator."
      />
      {editId && state.loading ? (
        <Loading />
      ) : state.error ? (
        <ErrorBox message={state.error} />
      ) : (
        <Card className="form-panel">
          <SimpleForm
            key={r?.id || actualKind}
            fields={fields}
            label={editId ? "Save changes" : "Save and continue"}
            onSubmit={async (f) => {
              const data = {
                type: f.type || "",
                location: f.location || "",
                industry: f.industry || "",
                arrangement: f.arrangement || "",
                salary: f.salary || "",
                deadline: f.deadline ? new Date(f.deadline).toISOString() : "",
                startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : "",
                endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : "",
                requirements: f.requirements || "",
                skills: (f.skills || "")
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
                ...(f.capacity ? { capacity: Number(f.capacity) } : {}),
                ...(f.goal ? { goal: Number(f.goal) } : {}),
              };
              await api(
                editId ? "resources/" + editId : "resources",
                editId ? "PATCH" : "POST",
                {
                  ...(editId ? {} : { kind: actualKind }),
                  title: f.title,
                  description: f.description,
                  status: f.status,
                  data,
                },
              );
              toast("Saved. Public listings require administrator approval.");
              router.push("/app/manage");
            }}
          />
        </Card>
      )}
    </>
  );
}
