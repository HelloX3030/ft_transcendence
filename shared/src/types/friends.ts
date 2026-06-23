export type friendStatus = "pending" | "accepted";

export interface Friend {
  friendId: number;
  status: friendStatus;
  createdAt: Date;
}
