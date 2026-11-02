import { Suspense } from "react";
import { ProfilePageShell, ProfileServicesSkeleton } from "@/components/profile/profile-page-shell";
import { ProfileServices } from "@/components/profile/profile-services";

export default function ProfileLoading() {
  return <ProfilePageShell services={<Suspense fallback={<ProfileServicesSkeleton />}><ProfileServices /></Suspense>} />;
}
