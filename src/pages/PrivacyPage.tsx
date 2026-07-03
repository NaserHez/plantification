import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Leaf } from "lucide-react";

// This page is maintained by the Plantification team to answer common privacy
// and data-handling questions. It reflects the app's current, in-product
// controls — it is not a legal contract or certification.

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-background pb-16">
      <div className="px-4 pt-4 pb-2 flex items-center gap-3 max-w-2xl mx-auto">
        <Link
          to="/"
          className="p-2 -ml-2 rounded-xl hover:bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-serif flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" /> Privacy
        </h1>
      </div>

      <main className="px-4 max-w-2xl mx-auto space-y-6 mt-2 text-sm leading-relaxed">
        <section className="bg-card rounded-2xl p-5 border border-border space-y-2">
          <p className="text-muted-foreground">
            This page is maintained by the Plantification team to answer common
            privacy questions about the app. It describes what we currently
            collect, how it's stored, and the controls you have.
          </p>
        </section>

        <section className="bg-card rounded-2xl p-5 border border-border space-y-3">
          <h2 className="font-serif text-lg flex items-center gap-2">
            <Leaf className="w-4 h-4 text-primary" /> What we collect
          </h2>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li>
              <span className="text-foreground font-medium">Account:</span>{" "}
              your email address (required to sign in) and, optionally, a
              display name, garden name, garden bio, and avatar.
            </li>
            <li>
              <span className="text-foreground font-medium">Plants &amp; care:</span>{" "}
              plants you add, photos you upload, care schedules, watering
              history, journal entries, and diagnosis history.
            </li>
            <li>
              <span className="text-foreground font-medium">Community:</span>{" "}
              posts, comments, likes, and reports you create in the community
              tab.
            </li>
            <li>
              <span className="text-foreground font-medium">Device settings:</span>{" "}
              language, theme, unit preference, reminder time, notification
              tone, and (if you opt in) a push-notification subscription for
              watering reminders.
            </li>
            <li>
              <span className="text-foreground font-medium">Location:</span>{" "}
              approximate coordinates only when you allow browser geolocation
              for the weather widget or planting calendar — never stored.
            </li>
          </ul>
          <p className="text-xs text-muted-foreground pt-1">
            We ask only for what the app needs to work. Optional fields are
            clearly marked and can be left blank.
          </p>
        </section>

        <section className="bg-card rounded-2xl p-5 border border-border space-y-3">
          <h2 className="font-serif text-lg">How your data is stored</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li>
              All traffic between your device and our backend uses HTTPS/TLS.
            </li>
            <li>
              Passwords are never stored in plain text — they are hashed by
              our managed authentication service.
            </li>
            <li>
              Plant photos are stored in a private bucket and served through
              short-lived signed URLs so only you (or people you invite to a
              shared garden) can view them.
            </li>
            <li>
              Row-level access rules restrict every table so users can only
              read and write their own rows.
            </li>
          </ul>
        </section>

        <section className="bg-card rounded-2xl p-5 border border-border space-y-3">
          <h2 className="font-serif text-lg">Third parties we send data to</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li>
              <span className="text-foreground font-medium">Plant.id</span> —
              receives the plant photo you submit for identification.
            </li>
            <li>
              <span className="text-foreground font-medium">Lovable AI Gateway</span>{" "}
              (Google Gemini) — receives your chat messages, plant names,
              and photos for care advice and diagnosis. Not used to train
              third-party models.
            </li>
            <li>
              <span className="text-foreground font-medium">Open-Meteo</span> —
              receives the approximate coordinates you allow the browser to
              share, so we can return a local forecast.
            </li>
          </ul>
        </section>

        <section className="bg-card rounded-2xl p-5 border border-border space-y-3">
          <h2 className="font-serif text-lg">Your controls</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li>
              <span className="text-foreground font-medium">Export:</span>{" "}
              per-plant PDF reports are available from any plant page.
            </li>
            <li>
              <span className="text-foreground font-medium">Notifications:</span>{" "}
              turn watering reminders on/off in Settings; you can also revoke
              permission at the browser level.
            </li>
            <li>
              <span className="text-foreground font-medium">Delete account:</span>{" "}
              Settings → Danger zone → Delete account. This removes your
              profile, plants, photos, journal entries, community posts, and
              sign-in credentials. The action is irreversible.
            </li>
          </ul>
        </section>

        <section className="bg-card rounded-2xl p-5 border border-border space-y-2">
          <h2 className="font-serif text-lg">Contact</h2>
          <p className="text-muted-foreground">
            Questions or privacy requests? Email{" "}
            <a href="mailto:support@plantification.app" className="text-primary underline">
              support@plantification.app
            </a>
            .
          </p>
        </section>
      </main>
    </div>
  );
}
