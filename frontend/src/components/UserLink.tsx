import Link from "next/link";

interface UserLinkProps {
  username: string;
  className?: string;
  label?: string;
}

export default function UserLink({ username, className = "", label }: UserLinkProps) {
  return (
    <Link
      href={`/profile/${encodeURIComponent(username)}`}
      className={`hover:underline ${className}`}
    >
      {label ?? username}
    </Link>
  );
}
