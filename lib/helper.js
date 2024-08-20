import { userSocketIDs } from "../app.js";

// export const getOtherMember = (members, userId) => {
//   members.find((member) => member._id.toString() !== userId._id.toString());
// };
export const getOtherMember = (members, userId) => {
  return members.find((member) => member._id.toString() !== userId.toString());
};
// export const getOtherMember=(members, currentUser) =>{
//   return members.find(member => !member._id.equals(currentUser._id));
// }


export const getSockets = (users=[]) => {
  const sockets = users.map((user) => userSocketIDs.get(user.toString()));
  return sockets;
};
// export const getSockets = (users) => {
//   return users
//     .map((user) => userSocketIDs.get(user._id.toString()))
//     .filter((socketId) => socketId !== undefined); // Filter out undefined socket IDs
// };

export const getBase64 = (file) =>
  `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
