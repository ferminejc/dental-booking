import Link from "next/link";
import { db } from "@/db/client";
import { getActiveServices, getClinicSettings } from "@/lib/booking-queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatPrice(pricePhp: number): string {
  return `₱${pricePhp.toLocaleString("en-PH")}`;
}

export default async function Home() {
  const [services, settings] = await Promise.all([getActiveServices(db), getClinicSettings(db)]);

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:py-12">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <header className="flex flex-col gap-1 text-center">
          <h1 className="text-2xl font-semibold text-foreground">{settings.name}</h1>
          <p className="text-sm text-muted-foreground">{settings.address}</p>
        </header>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Choose a service to book</h2>
          {services.map((service) => (
            <Card key={service.id}>
              <CardHeader>
                <CardTitle className="text-base">{service.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-4">
                <div className="text-sm text-muted-foreground">
                  {service.durationMin} min · {formatPrice(service.pricePhp)}
                </div>
                <Link
                  href={`/book/${service.id}`}
                  className={cn(buttonVariants({ variant: "default" }), "h-11 px-5 text-base")}
                >
                  Book
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        <Link
          href="/cancel"
          className="mt-2 text-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Need to cancel or reschedule a booking?
        </Link>
      </div>
    </div>
  );
}
