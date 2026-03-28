import Link from "next/link";

interface UserLinkProps {
  username: string;
  className?: string;
}

export default function UserLink({ username, className = "" }: UserLinkProps) {
  return (
    <Link
      href={`/profile/${username}`}
      className={`hover:underline ${className}`}
    >
      {username}
    </Link>
  );
}
