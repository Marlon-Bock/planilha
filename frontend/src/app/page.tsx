"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Na hospedagem o Laravel já redireciona "/" para "/dashboard"; isto cobre o modo de desenvolvimento.
export default function Home() {
  const router = useRouter();
  useEffect(() => router.replace("/dashboard"), [router]);
  return null;
}
