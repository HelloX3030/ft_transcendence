export type friendStatus = "pending" | "accepted";

export interface Friend {
  friendId: number;
  status: friendStatus;
  initiatorId: number;
  createdAt: Date;
}
