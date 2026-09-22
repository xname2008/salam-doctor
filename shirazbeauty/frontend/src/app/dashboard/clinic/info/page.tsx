import { redirect } from "next/navigation";

export default function ClinicInfoRedirect() {
  redirect("/dashboard/clinic/profile");
}
