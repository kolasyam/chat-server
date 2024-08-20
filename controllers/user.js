import { compare } from "bcrypt";
import { User } from "../models/user.js";
import {
  cookieOptions,
  emitEvent,
  sendToken,
  uploadFilesToCloudinary,
} from "../utils/features.js";
import { TryCatch } from "../middlewares/error.js";
import { ErrorHandler } from "../utils/utility.js";
import { Chat } from "../models/chat.js";
import { Request } from "../models/request.js";
import { NEW_REQUEST, REFETCH_CHATS } from "../constants/events.js";
import { getOtherMember } from "../lib/helper.js";
const newUser = TryCatch(async (req, res, next) => {
  const {name, username, bio,password } = req.body;
  const file = req.file;
  if (!file) return next(new ErrorHandler("Please upload avatar", 401));
  const result = await uploadFilesToCloudinary([file]);
  const avatar = {
    public_id: result[0].public_id,
    url: result[0].url,
  };
  const user = await User.create({
    name,
    bio,
    username,
    password,
    avatar,
  });
  // res.status(201).json({message:"User created successfully"});
  sendToken(res, user, 201, "User created");
});
// const login = TryCatch(async (req, res, next) => {
//   try {
//     const { username, password } = req.body;
//     const user = await User.findOne({ username }).select("+password");
//     if (!user)
//       return next(new ErrorHandler("Invalid Username or Password", 404));

//     // res.status(400).json({ message: "username not found" });
//     const isMatch = await compare(password, user.password);
//     if (!isMatch) {
//       return next(new ErrorHandler("Invalid Username or Password", 404));

//       // res.status(400).json({ message: "Invalid password" });
//     }
//     sendToken(res, user, 200, `welcome back , ${user.name}`);
//   } catch (error) {
//     next(err);
//   }
// });
const login = TryCatch(async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username }).select("+password");
    if (!user) return next(new ErrorHandler("Invalid Username or Password", 404));

    const isMatch = await compare(password, user.password);
    if (!isMatch) return next(new ErrorHandler("Invalid Username or Password", 404));

    sendToken(res, user, 200, `Welcome back, ${user.name}`);
  } catch (error) {
    next(error); // Pass the error to the error handling middleware
  }
});

const getMyProfile = TryCatch(async (req, res, next) => {
  const user = await User.findById(req.user);
  if (!user) return next(new ErrorHandler("User not found", 404));
  res.status(200).json({
    success: true,
    user,
  });
});
const logout = TryCatch(async (req, res) => {
  res
    .status(200)
    .cookie("chat-token", "", { ...cookieOptions, maxAge: 0 })
    .json({
      success: true,
      message: "logged out successfully",
    });
});
const searchUser = TryCatch(async (req, res,next) => {
  const { name = "" } = req.query;
  //finding ALL my Chats
  const myChats = await Chat.find({ groupChat: false, members: req.user });
  //extrecting ALL users from my chats means friends or people I have chatted with
  const allUsersFromMyChats = myChats.flatMap((chat) => chat.members);
  //finding all users except me and my friend
  const allUsersExceptMeAndFriends = await User.find({
    _id: { $nin: allUsersFromMyChats },
    name: { $regex: name, $options: "i" },
  });
  //modifying the response
  const users = allUsersExceptMeAndFriends.map(({ _id, name, avatar }) => ({
    _id,
    name,
    avatar: avatar.url,
  }));
  res.status(200).json({
    success: true,
    users,
  });
});
const sendFriendRequest = TryCatch(async (req, res, next) => {
  const { userId } = req.body;
  const request = await Request.findOne({ 
    $or: [
      { sender: req.user, receiver: userId },
      { sender: userId, receiver: req.user },
    ],
  });
  if (request) return next(new ErrorHandler("Request already sent", 400));
  await Request.create({
    sender: req.user,
    receiver: userId,
  });
  emitEvent(req, NEW_REQUEST, [userId]);
  res.status(200).json({
    success: true,
    message: "Friend Request Sent",
  });
});
// const acceptFriendRequest = TryCatch(async (req, res, next) => {
//   const { requestId, accept } = req.body;
//   const request = await Request.findById(requestId)
//     .populate("sender", "name")
//     .populate("receiver", "name");
//   if (!request) return next(new ErrorHandler("Request not found", 404));
//   if (request.receiver._id.toString() !== req.user.toString()) {
//     return next(
//       new ErrorHandler("You are not authorized to accept this request", 401)
//     );
//   }
//   if (!accept) {
//     await request.deleteOne();
//     return res.status(200).json({
//       success: true,
//       message: "Friend Request Rejected",
//     });
//   }
//   const members = [request.sender._id, request.receiver._id];
//   await Promise.all([ 
//     Chat.create({
//       members,
//       name: `${request.sender.name}-${request.receiver.name}`,
//     }),
//     request.deleteOne(),
//   ]);
//   emitEvent(req, REFETCH_CHATS, members);

//   res.status(200).json({
//     success: true,
//     message: "Friend Request Accepted",
//     senderId: request.sender._id,
//   });
// });
const acceptFriendRequest = TryCatch(async (req, res, next) => {
  const { requestId, accept } = req.body;
  console.log('Request ID:', requestId);
  const request = await Request.findById(requestId)
    .populate("sender", "name")
    .populate("receiver", "name");
  if (!request) {
    console.log('Request not found');
    return next(new ErrorHandler("Request not found", 404));
  }
  if (request.receiver._id.toString() !== req.user.toString()) {
    console.log('Unauthorized access');
    return next(
      new ErrorHandler("You are not authorized to accept this request", 401)
    );
  }
  if (!accept) {
    await request.deleteOne();
    return res.status(200).json({
      success: true,
      message: "Friend Request Rejected",
    });
  }
  const members = [request.sender._id, request.receiver._id];
  await Promise.all([ 
    Chat.create({
      members,
      name: `${request.sender.name}-${request.receiver.name}`,
    }),
    request.deleteOne(),
  ]);
  emitEvent(req, REFETCH_CHATS, members);

  res.status(200).json({
    success: true,
    message: "Friend Request Accepted",
    senderId: request.sender._id,
  });
});

const getMyNotifications = TryCatch(async (req, res) => {
  const requests = await Request.find({ receiver: req.user }).populate(
    "sender",
    "name avatar"
  );
  const allRequests = requests.map(({ _id, sender }) => ({
    _id,
    sender: {
      _id: sender._id,
      name: sender.name,
      avatar: sender.avatar.url,
    },
  }));
  return res.status(200).json({
    success: true,
    allRequests,
  });
});
// const getMyFriends = TryCatch(async (req, res) => {
//   const chatId = req.query.chatId;
//   const chats = await Chat.find({
//     members: req.user,
//     groupChat: true,
//   }).populate("members", "name avatar");

//   const friends = chats
//     .map(({ members }) => {
//       const otherUser = getOtherMember(members, req.user);
//       if (!otherUser) {
//         return null;
//       }
//       return {
//         _id: otherUser._id,
//         name: otherUser.name,
//         avatar: otherUser.avatar.url,
//       };
//     })
//     .filter((friend) => friend !== null); // Filter out any null values

//   if (chatId) {
//     const chat = await Chat.findById(chatId);
//     const availableFriends = friends.filter(
//       (friend) => !chat.members.includes(friend._id)
//     );
//     return res.status(200).json({
//       success: true,
//       allRequests: availableFriends,
//     });
//   } else {
//     return res.status(200).json({
//       success: true,
//       allRequests:friends,
//     });
//   }
// });
const getMyFriends = TryCatch(async (req, res) => {
  const chatId = req.query.chatId;
  const chats = await Chat.find({
    members: req.user,
    groupChat: false,
  }).populate("members", "name avatar");

  const friends = chats
    .map(({ members }) => {
      const otherUser = getOtherMember(members, req.user);
      if (!otherUser) {
        return null;
      }
      return {
        _id: otherUser._id,
        name: otherUser.name,
        avatar: otherUser.avatar.url,
      };
    })
    .filter((friend) => friend !== null); // Filter out any null values

  if (chatId) {
    const chat = await Chat.findById(chatId);
    const availableFriends = friends.filter(
      (friend) => !chat.members.includes(friend._id)
    );
    return res.status(200).json({
      success: true,
      allRequests: availableFriends,
    });
  } else {
    return res.status(200).json({
      success: true,
      allRequests: friends,
    });
  }
});
// const getMyFriends = TryCatch(async (req, res) => {
//   const chatId = req.query.chatId;

//   // Fetch all chats involving the current user that are not group chats
//   const chats = await Chat.find({
//     members: req.user,
//     groupChat: false,
//   }).populate("members", "name avatar");

//   // Debugging: Log the chats fetched from the database
//   console.log("Fetched Chats:", chats);

//   // Process each chat to find the other member
//   const friends = chats
//     .map(({ members }) => {
//       const otherUser = getOtherMember(members, req.user);

//       // Debugging: Log the identified other member
//       console.log("Other User:", otherUser);

//       if (!otherUser) {
//         return null;
//       }
//       return {
//         _id: otherUser._id,
//         name: otherUser.name,
//         avatar: otherUser.avatar.url,
//       };
//     })
//     .filter((friend) => friend !== null); // Filter out any null values

//   // Debugging: Log the friends list
//   console.log("Friends List:", friends);

//   if (chatId) {
//     // Fetch the specific chat based on chatId
//     const chat = await Chat.findById(chatId);

//     // Debugging: Log the chat details
//     console.log("Specific Chat:", chat);

//     // Filter friends who are not part of the specified chat
//     const availableFriends = friends.filter(
//       (friend) => !chat.members.some((member) => member.equals(friend._id))
//     );

//     // Debugging: Log the available friends
//     console.log("Available Friends:", availableFriends);

//     return res.status(200).json({
//       success: true,
//       allRequests: availableFriends,
//     });
//   } else {
//     return res.status(200).json({
//       success: true,
//       allRequests: friends,
//     });
//   }
// });

export {
  login,
  newUser,
  getMyProfile,
  logout,
  searchUser,
  sendFriendRequest,
  acceptFriendRequest,
  getMyNotifications,
  getMyFriends,
};
