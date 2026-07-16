import Link from "next/link";
import { CancelForm } from "@/components/booking/cancel-form";

export default function CancelPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <Link
          href="/"
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          ← All services
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Cancel a booking</h1>
          <p className="text-sm text-muted-foreground">
            Enter your reference code and mobile number to cancel a pending or confirmed booking.
          </p>
        </div>
        <CancelForm />
      </div>
    </div>
  );
}
