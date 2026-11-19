import type { Member } from "@/types";

export function Avatar({ member, size = 36 }: { member: Member; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold text-[#071a33]"
      style={{ width: size, height: size, background: member.color, fontSize: size * 0.42 }}
      aria-hidden
    >
      {member.name.charAt(0).toUpperCase()}
    </span>
  );
}
